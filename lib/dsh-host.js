import { execFileSync } from 'node:child_process';
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
        const prompt = [{ type: 'text', text: request.prompt }];
        const agentOptions = {
            provider: request.route.provider,
            model: request.route.model,
            ...(request.route.reasoningEffort ? { reasoningEffort: request.route.reasoningEffort } : {}),
            ...(request.route.maxTokens ? { maxTokens: request.route.maxTokens } : {}),
        };
        if (request.role === 'executor') {
            return this.startExecutor(parent, request, prompt, agentOptions);
        }
        return this.startOneShot(parent, request, prompt, agentOptions);
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
        this.registerChild(run.id, parent);
        const result = run.result
            .then((value) => ({
            childId: run.id,
            output: contentToText(value.output),
            interrupted: value.stopReason !== 'completed',
            ...(value.stopReason !== 'completed' ? { reason: value.stopReason } : {}),
            ...(value.diagnostic ? { testSummary: [value.diagnostic] } : {}),
            ...(value.structured !== undefined ? { structured: value.structured } : {}),
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
            if (existing) {
                const agent = existing;
                this.interruptedChildren.delete(existingId);
                const done = this.waitForExecutorSettlement(agent, existingId);
                await this.ctx.subagents.sendMessage(parent, existingId, prompt, {
                    signal: new AbortController().signal,
                });
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
        const started = await this.ctx.subagents.startContinuable({
            provider: 'spawn',
            label: request.label,
            request: {
                prompt,
                parent,
                agentOptions,
                ...(request.toolFilter ? { toolFilter: request.toolFilter } : {}),
            },
            signal: controller.signal,
        });
        const childId = String(started.childId);
        this.registerChild(childId, parent);
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
    registerChild(childId, parent) {
        this.ownedChildren.add(childId);
        this.childParents.set(childId, parent);
    }
    forgetChild(childId) {
        this.ownedChildren.delete(childId);
        this.interruptedChildren.delete(childId);
        this.childParents.delete(childId);
    }
    async interruptExecutor(childId, reason) {
        this.interruptedChildren.add(childId);
        const parent = this.childParents.get(childId);
        this.ctx.subagents.interrupt(childId, parent ? { kind: 'ancestor', agent: parent } : { kind: 'user', parentSessionId: childId });
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
    async waitForExecutorSettlement(agent, childId) {
        await this.waitForTurnOrIdle(agent);
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
            default:
                return { childId, output, interrupted: true, reason: 'EXECUTOR_NO_TURN', telemetry, ...evidence };
        }
    }
    async waitForTurnOrIdle(agent) {
        const deadline = this.nowFn() + EXECUTOR_TURN_START_TIMEOUT_MS;
        while (this.nowFn() < deadline && !this.hasTurnStarted(agent)) {
            await this.sleepFn(20);
        }
        await agent.whenIdle?.();
    }
    hasTurnStarted(agent) {
        const events = agent.session?.snapshotEvents?.() ?? [];
        return events.some((event) => event.type === 'turn/start');
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
    /**
     * Mutation ownership is about top-level autonomous drivers, not about every
     * running agent. The calling parent, Orbit's own children, and ordinary
     * conversational/read-only agents are never competitors. Goal is the one
     * DSH-native driver with a readable active state; ralph/workflow are blocked
     * at tool start by the Orbit mutation guard.
     */
    async otherMutationDrivers(cwd) {
        void cwd;
        const drivers = [];
        const initiator = this.ctx.agents.currentInitiator();
        // `ctx.reflect.get` is the official service lookup that does not require an
        // inject declaration, so Orbit stays loadable in profiles without dsh-goal.
        const reflect = this.ctx.reflect;
        const goals = reflect?.get('goals');
        if (goals && initiator) {
            try {
                const goal = goals.get(initiator);
                if (goal?.phase === 'active')
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
