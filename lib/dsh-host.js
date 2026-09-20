import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { SessionId } from '@deepseek-ai/dsh-session';
import { collectTurnToolFacts } from "./evidence.js";
import { redactText, truncateSafe } from "./sanitize.js";
import { classifyTurnSettlement } from "./settlement.js";
const EXECUTOR_TURN_START_TIMEOUT_MS = 5_000;
function contentToText(blocks) {
    if (!blocks)
        return '';
    return blocks
        .map((block) => (block.type === 'text' ? block.text : `[${block.type}]`))
        .join('\n');
}
function visibleContentToText(blocks) {
    return blocks?.flatMap((block) => block.type === 'text' && block.text.trim() !== '' ? [block.text] : []).join('\n') ?? '';
}
/**
 * Wire the Orbit supervisor to DeepSeek Harness native Agent/Subagent services.
 *
 * Roles keep the Pi-validated split:
 * - Commander/Watchdog: one-shot children, cancelled through the launch signal
 *   plus `run.dispose()` (the real one-shot cancellation seam).
 * - Executor: continuable child so a runtime restart can interrupt it and a
 *   resume can reuse the same child.
 */
export class DshOrbitHost {
    ctx;
    ownedChildren = new Set();
    interruptedChildren = new Set();
    childParents = new Map();
    childGrants = new Map();
    nowFn;
    sleepFn;
    constructor(ctx, options = {}) {
        this.ctx = ctx;
        this.nowFn = options.now ?? (() => Date.now());
        this.sleepFn = options.sleep ?? defaultSleep;
    }
    now() {
        return this.nowFn();
    }
    sleep(ms, signal) {
        return this.sleepFn(ms, signal);
    }
    async startRole(request) {
        const parent = this.parent();
        if (request.workspace !== undefined && resolve(parent.session.header.cwd ?? process.cwd()) !== resolve(request.workspace)) {
            throw new Error('ORBIT_WORKSPACE_MISMATCH: 子代理工作目录必须与 Orbit 持有的 workspace 一致。');
        }
        const prompt = [{ type: 'text', text: request.prompt }];
        const agentOptions = {
            provider: request.route.provider,
            model: request.route.model,
            reasoningEffort: request.route.reasoningEffort,
        };
        if (request.role === 'executor') {
            return this.startExecutor(parent, request, prompt, agentOptions);
        }
        return this.startOneShot(parent, request, prompt, agentOptions);
    }
    async runModel(request) {
        const handle = await this.startRole({
            role: 'commander',
            label: request.label,
            prompt: request.prompt,
            route: request.route,
            toolFilter: { allow: [] },
            ...(request.signal ? { signal: request.signal } : {}),
        });
        try {
            const result = await handle.result;
            return {
                output: result.visibleOutput ?? result.output,
                interrupted: result.interrupted,
                ...(result.reason ? { reason: result.reason } : {}),
                ...(result.tokenUsage ? { usage: result.tokenUsage } : {}),
            };
        }
        finally {
            await this.releaseRole(handle);
        }
    }
    parent() {
        const initiator = this.ctx.agents.currentInitiator();
        if (initiator)
            return initiator;
        return this.ctx.agents.requireInitiator();
    }
    async startOneShot(parent, request, prompt, agentOptions) {
        const controller = new AbortController();
        const onAbort = () => controller.abort();
        request.signal?.addEventListener('abort', onAbort, { once: true });
        const run = (await this.ctx.subagents.start('spawn', {
            label: request.label,
            prompt,
            parent,
            signal: controller.signal,
            agentOptions,
            ...(request.toolFilter ? { toolFilter: request.toolFilter } : {}),
            ...(request.outputSchema ? { outputSchema: request.outputSchema } : {}),
        }));
        this.registerChild(run.id, parent, request);
        const result = run.result
            .then((value) => ({
            childId: run.id,
            output: contentToText(value.output),
            visibleOutput: visibleContentToText(value.output),
            interrupted: value.stopReason !== 'completed',
            ...(value.stopReason !== 'completed' ? { reason: value.stopReason } : {}),
            ...(value.diagnostic ? { testSummary: [value.diagnostic] } : {}),
            ...(value.structured !== undefined ? { structured: value.structured } : {}),
            ...(this.readTokenUsage(run.localAgent) ? { tokenUsage: this.readTokenUsage(run.localAgent) } : {}),
        }))
            .catch((error) => ({
            childId: run.id,
            output: '',
            interrupted: true,
            reason: error instanceof Error ? error.message : String(error),
        }));
        return {
            childId: run.id,
            result,
            cancel: async (reason) => {
                this.interruptedChildren.add(run.id);
                controller.abort(new Error(reason));
                await run.dispose();
                this.forgetChild(run.id);
            },
            dispose: async () => {
                await run.dispose();
                this.forgetChild(run.id);
            },
            runtimeSnapshot: () => this.snapshotAgent(run.localAgent),
        };
    }
    async startExecutor(parent, request, prompt, agentOptions) {
        if (request.resumeOf) {
            const existingId = request.resumeOf;
            const existing = this.ctx.agents.get(existingId);
            const grant = this.childGrants.get(existingId);
            const requestedTools = new Set(request.toolFilter?.allow ?? []);
            const sameGrant = grant?.role === 'executor' && grant.workspace === (request.workspace ?? parent.session.header.cwd ?? process.cwd())
                && grant.tools.size === requestedTools.size && [...grant.tools].every((tool) => requestedTools.has(tool));
            if (existing && sameGrant && this.childParents.get(existingId) === parent && this.ctx.agents.isOwnedBy(SessionId(existingId), parent)) {
                const agent = existing;
                this.interruptedChildren.delete(existingId);
                const previousTurns = (agent.session?.snapshotEvents?.() ?? []).filter((event) => event.type === 'turn/start').length;
                await this.ctx.subagents.sendMessage(parent, existingId, prompt, {
                    signal: request.signal ?? new AbortController().signal,
                });
                const done = this.waitForExecutorSettlement(agent, existingId, previousTurns);
                return {
                    childId: existingId,
                    result: done,
                    cancel: async (reason) => this.interruptExecutor(existingId, reason),
                    dispose: async () => this.drainExecutor(parent, existingId),
                    runtimeSnapshot: () => this.snapshotAgent(agent),
                };
            }
        }
        const controller = new AbortController();
        request.signal?.addEventListener('abort', () => controller.abort(), { once: true });
        const reservedId = SessionId(randomUUID());
        const childId = String(reservedId);
        this.registerChild(childId, parent, request);
        let started;
        try {
            started = await this.ctx.subagents.startContinuable({
                provider: 'spawn',
                label: request.label,
                childId: reservedId,
                request: {
                    prompt,
                    parent,
                    agentOptions,
                    ...(request.toolFilter ? { toolFilter: request.toolFilter } : {}),
                },
                signal: controller.signal,
            });
        }
        catch (error) {
            this.forgetChild(childId);
            throw error;
        }
        const agent = this.ctx.agents.get(started.childId);
        const result = agent
            ? this.waitForExecutorSettlement(agent, childId)
            : Promise.resolve({ childId, output: '', interrupted: true, reason: 'EXECUTOR_CHILD_MISSING' });
        return {
            childId,
            result,
            cancel: async (reason) => this.interruptExecutor(childId, reason),
            dispose: async () => this.drainExecutor(parent, childId),
            runtimeSnapshot: agent ? () => this.snapshotAgent(agent) : undefined,
        };
    }
    registerChild(childId, parent, request) {
        this.ownedChildren.add(childId);
        this.childParents.set(childId, parent);
        this.childGrants.set(childId, {
            role: request.role,
            workspace: resolve(request.workspace ?? parent.session.header.cwd ?? process.cwd()),
            tools: new Set(request.toolFilter?.allow ?? []),
        });
    }
    forgetChild(childId) {
        this.ownedChildren.delete(childId);
        this.interruptedChildren.delete(childId);
        this.childParents.delete(childId);
        this.childGrants.delete(childId);
    }
    async interruptExecutor(childId, reason) {
        this.interruptedChildren.add(childId);
        const parent = this.childParents.get(childId);
        this.ctx.subagents.interrupt(childId, parent ? { kind: 'ancestor', agent: parent } : { kind: 'user', parentSessionId: childId });
        await this.ctx.agents.get(SessionId(childId))?.whenIdle();
        void reason;
    }
    async drainExecutor(parent, childId) {
        try {
            await this.ctx.subagents.drainContinuableChildren(parent, [childId]);
        }
        catch {
            // already released
        }
        this.forgetChild(childId);
    }
    async waitForExecutorSettlement(agent, childId, previousTurns = 0) {
        await this.waitForTurnOrIdle(agent, previousTurns);
        const events = agent.session?.snapshotEvents?.() ?? agent.session?.ownEvents?.() ?? [];
        const classified = classifyTurnSettlement(events);
        const output = this.readFinalOutput(agent);
        const telemetry = await this.snapshotAgent(agent);
        // Evidence is read from the settled turn's own events; a resumed executor
        // therefore reports only the turn that just finished, never an earlier one.
        const toolEvidence = collectTurnToolFacts(events);
        const evidence = {
            settlement: classified.settlement,
            ...(toolEvidence.length > 0 ? { toolEvidence } : {}),
        };
        if (this.interruptedChildren.has(childId)) {
            return { childId, output, interrupted: true, reason: 'EXECUTOR_INTERRUPTED', telemetry, ...evidence };
        }
        switch (classified.settlement) {
            case 'completed':
                return { childId, output, interrupted: false, telemetry, ...evidence };
            case 'aborted':
                return {
                    childId,
                    output,
                    interrupted: true,
                    reason: `EXECUTOR_ABORTED${classified.cancelCause ? `:${classified.cancelCause}` : ''}`,
                    telemetry,
                    ...evidence,
                };
            case 'error':
                return {
                    childId,
                    output,
                    interrupted: true,
                    reason: `EXECUTOR_ERROR: ${redactText(classified.errorMessage ?? 'unknown failure')}`,
                    telemetry,
                    ...evidence,
                };
            case 'blocked':
                return { childId, output, interrupted: true, reason: 'EXECUTOR_BLOCKED', telemetry, ...evidence };
            case 'max-tokens':
                return { childId, output, interrupted: true, reason: 'EXECUTOR_MAX_TOKENS', telemetry, ...evidence };
            case 'interrupted':
                return { childId, output, interrupted: true, reason: 'EXECUTOR_INTERRUPTED', telemetry, ...evidence };
            default:
                return { childId, output, interrupted: true, reason: 'EXECUTOR_NO_TURN', telemetry, ...evidence };
        }
    }
    async waitForTurnOrIdle(agent, previousTurns = 0) {
        const deadline = this.nowFn() + EXECUTOR_TURN_START_TIMEOUT_MS;
        while (this.nowFn() < deadline && !this.hasTurnStarted(agent, previousTurns)) {
            await this.sleepFn(20);
        }
        await agent.whenIdle?.();
    }
    hasTurnStarted(agent, previousTurns) {
        const events = agent.session?.snapshotEvents?.() ?? [];
        return events.filter((event) => event.type === 'turn/start').length > previousTurns;
    }
    readTokenUsage(agent) {
        const events = agent?.session?.snapshotEvents?.() ?? agent?.session?.ownEvents?.() ?? [];
        for (let index = events.length - 1; index >= 0; index -= 1) {
            const event = events[index];
            if (!event || event.type !== 'assistant/message')
                continue;
            const usage = event.data?.usage;
            if (typeof usage?.inputTokens !== 'number' || typeof usage.outputTokens !== 'number')
                continue;
            return {
                inputTokens: usage.inputTokens,
                outputTokens: usage.outputTokens,
                ...(typeof usage.totalTokens === 'number' ? { totalTokens: usage.totalTokens } : {}),
                ...(typeof usage.cacheReadTokens === 'number' ? { cacheReadTokens: usage.cacheReadTokens } : {}),
                ...(typeof usage.cacheWriteTokens === 'number' ? { cacheWriteTokens: usage.cacheWriteTokens } : {}),
            };
        }
        return undefined;
    }
    readFinalOutput(agent) {
        const events = agent.session?.snapshotEvents?.() ?? agent.session?.ownEvents?.() ?? [];
        for (let index = events.length - 1; index >= 0; index -= 1) {
            const event = events[index];
            if (!event || event.type !== 'assistant/message')
                continue;
            const data = event.data;
            const text = contentToText(data?.message?.content ?? data?.content);
            if (text.trim())
                return text;
        }
        return '';
    }
    /** Bounded telemetry for the exact agent behind a handle. */
    async snapshotAgent(agent) {
        if (!agent)
            return { status: 'unknown' };
        const events = agent.session?.snapshotEvents?.() ?? [];
        const openCalls = new Map();
        let turnCount = 0;
        let toolCount = 0;
        let lastAssistant = '';
        for (const event of events) {
            if (event.type === 'turn/end')
                turnCount += 1;
            if (event.type === 'tool/call') {
                toolCount += 1;
                const data = event.data;
                if (data?.callId)
                    openCalls.set(data.callId, data.name ?? 'unknown');
            }
            if (event.type === 'tool/result') {
                const data = event.data;
                if (data?.callId)
                    openCalls.delete(data.callId);
            }
            if (event.type === 'assistant/message') {
                const data = event.data;
                const text = contentToText(data?.message?.content ?? data?.content);
                if (text.trim())
                    lastAssistant = text;
            }
        }
        const currentTool = [...openCalls.values()].pop();
        return {
            status: agent.status ?? 'unknown',
            activity_state: agent.status ?? 'unknown',
            turn_count: turnCount,
            tool_count: toolCount,
            ...(currentTool ? { current_tool: currentTool } : {}),
            ...(lastAssistant ? { recent_output: truncateSafe(lastAssistant, 1500) } : {}),
        };
    }
    async interruptRole(handle, reason) {
        if (handle.cancel) {
            await handle.cancel(reason);
            return;
        }
        if (handle.childId)
            await this.interruptExecutor(handle.childId, reason);
    }
    async releaseRole(handle) {
        if (handle.dispose) {
            await handle.dispose();
            return;
        }
        if (handle.childId) {
            const parent = this.childParents.get(handle.childId);
            if (parent)
                await this.drainExecutor(parent, handle.childId);
        }
    }
    hasTool(name) {
        // Standard profiles mount their tool composition on the agent plane
        // (agent presets), so the visible set must resolve against the initiating
        // agent's scope. Without an initiator this falls back to the global view.
        const agent = this.ctx.agents.currentInitiator();
        return this.ctx.tools.get(name, agent) !== undefined;
    }
    async validateRoutes(routes, signal) {
        const issues = [];
        const labels = { commander: '指挥官', executor: '执行员', watchdog: '监控模型' };
        for (const [role, route] of Object.entries(routes)) {
            const label = labels[role] ?? role;
            try {
                const llm = this.ctx.reflect.get('llm');
                if (!llm)
                    throw new Error('DSH LLM registry 不可用');
                const deadline = AbortSignal.timeout(10_000);
                const activeSignal = signal ? AbortSignal.any([signal, deadline]) : deadline;
                const info = await llm.resolveModelInfo(route.provider, route.model, activeSignal);
                const catalog = await llm.listModels(route.provider);
                if (catalog.length > 0 && !catalog.some((entry) => entry.id === route.model)) {
                    issues.push(`${label}：ORBIT_MODEL_UNAVAILABLE (${route.provider}/${route.model})，当前模型目录中不存在，请重新选择。`);
                    continue;
                }
                if (route.reasoningEffort !== undefined) {
                    const efforts = info.reasoning?.efforts ?? [];
                    if (!efforts.some((effort) => effort.id === route.reasoningEffort)) {
                        issues.push(`${label}：ORBIT_REASONING_EFFORT_UNAVAILABLE (${route.provider}/${route.model}/${route.reasoningEffort})，当前模型未声明此推理等级。`);
                    }
                }
            }
            catch (error) {
                issues.push(`${label}：ORBIT_MODEL_UNAVAILABLE (${route.provider}/${route.model})，当前不可用，请重新选择：${truncateSafe(error instanceof Error ? error.message : String(error), 200)}`);
            }
        }
        return issues;
    }
    isMutationAuthorized(agent, cwd, tool) {
        const id = String(agent?.id ?? '');
        const grant = this.childGrants.get(id);
        const parent = this.childParents.get(id);
        return grant?.role === 'executor' && grant.workspace === resolve(cwd) && grant.tools.has(tool)
            && !this.interruptedChildren.has(id) && this.ctx.agents.get(SessionId(id)) === agent
            && parent !== undefined && this.ctx.agents.isOwnedBy(SessionId(id), parent);
    }
    async revokeWorkspace(cwd) {
        const ids = [...this.childGrants].filter(([, grant]) => grant.workspace === resolve(cwd) && grant.role === 'executor').map(([id]) => id);
        for (const id of ids) {
            const parent = this.childParents.get(id);
            await this.interruptExecutor(id, 'ORBIT_WORKSPACE_RELEASED');
            if (parent)
                await this.drainExecutor(parent, id);
        }
    }
    /**
     * Mutation ownership is about top-level autonomous drivers, not about every
     * running agent. The calling parent, Orbit's own children, and ordinary
     * conversational/read-only agents are never competitors. Goal is the one
     * DSH-native driver with a readable active state; ralph/workflow are blocked
     * at tool start by the Orbit mutation guard.
     */
    async otherMutationDrivers(cwd) {
        const drivers = [];
        const initiator = this.ctx.agents.currentInitiator();
        // `ctx.reflect.get` is the official service lookup that does not require an
        // inject declaration, so Orbit stays loadable in profiles without dsh-goal.
        const reflect = this.ctx.reflect;
        const goals = reflect?.get('goals');
        const agents = this.ctx.agents.list?.() ?? (initiator ? [initiator] : []);
        for (const candidate of agents) {
            if (!goals || resolve(candidate.session.header.cwd ?? process.cwd()) !== resolve(cwd) || this.ownedChildren.has(String(candidate.id)))
                continue;
            try {
                const goal = goals.get(candidate);
                if (goal?.phase === 'active' && !drivers.includes('goal'))
                    drivers.push('goal');
            }
            catch {
                // goal service is present but not readable for this initiator
            }
        }
        return drivers;
    }
    changedFiles(cwd) {
        try {
            const output = execFileSync('git', ['-C', cwd, 'status', '--porcelain'], {
                encoding: 'utf8',
                timeout: 5000,
                stdio: ['ignore', 'pipe', 'ignore'],
            });
            return output
                .split('\n')
                .map((line) => line.slice(3).trim())
                .filter((line) => line.length > 0 && !line.startsWith('.cx/'));
        }
        catch {
            return [];
        }
    }
}
function defaultSleep(ms, signal) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, ms);
        const onAbort = () => {
            clearTimeout(timer);
            reject(new Error('ORBIT_ABORTED'));
        };
        signal?.addEventListener('abort', onAbort, { once: true });
    });
}
