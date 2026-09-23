/**
 * Bounded execution evidence assembled from real DSH session events.
 *
 * Everything in a bundle comes from data Orbit already has when a child
 * settles: current-turn `tool/call` + `tool/result` events, the durable turn
 * settlement, the executor's final text, real workspace changes, and agent
 * telemetry. Nothing is inferred, nothing is re-run, and no extra model call
 * is made. Bundles are sanitized and bounded before they reach a prompt, and
 * they are never persisted into `.cx/state.json` as a whole.
 */
import { redactText, redactValue } from "./sanitize.js";
export const EVIDENCE_LIMITS = {
    changedFiles: 50,
    toolEvidence: 20,
    testEvidence: 10,
    entry: 400,
    toolResult: 1200,
    executorSummary: 2000,
    total: 8000,
};
const TEST_COMMAND_PATTERN = /(?:\b(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?test\b|\bnode\s+--test\b|\bvitest\b|\bjest\b|\bpytest\b|\bcargo\s+test\b|\bgo\s+test\b|\bmake\s+test\b)/u;
/** True when a real command string is recognizably a test invocation. */
export function isTestCommand(command) {
    return TEST_COMMAND_PATTERN.test(command);
}
/** Strictly bound and redact one string without exceeding `max` characters. */
function bounded(value, max) {
    const redacted = redactText(value);
    if (redacted.length <= max)
        return redacted;
    const marker = '...[truncated]';
    return `${redacted.slice(0, Math.max(0, max - marker.length))}${marker}`;
}
function eventTurn(event) {
    const turn = event.data?.turn;
    return typeof turn === 'number' ? turn : undefined;
}
/** The most recent turn boundary in the log (closed or open), if any. */
function currentTurnOf(events) {
    for (let index = events.length - 1; index >= 0; index -= 1) {
        const event = events[index];
        if (event?.type !== 'turn/end' && event?.type !== 'turn/start')
            continue;
        const turn = eventTurn(event);
        if (turn !== undefined)
            return turn;
    }
    return undefined;
}
function textFromToolContent(value) {
    if (typeof value === 'string')
        return value;
    if (Array.isArray(value))
        return value.map((entry) => textFromToolContent(entry)).filter(Boolean).join('\n');
    if (!value || typeof value !== 'object')
        return '';
    const record = value;
    if (record['type'] === 'text' && typeof record['text'] === 'string')
        return record['text'];
    if ('content' in record)
        return textFromToolContent(record['content']);
    return '';
}
function commandOf(argumentsJson) {
    if (!argumentsJson)
        return undefined;
    try {
        const parsed = JSON.parse(argumentsJson);
        return typeof parsed.command === 'string' && parsed.command.length > 0 ? parsed.command : undefined;
    }
    catch {
        return undefined;
    }
}
function runCodeNestedBash(argumentsJson) {
    if (!argumentsJson)
        return undefined;
    try {
        const parsed = JSON.parse(argumentsJson);
        if (typeof parsed.code !== 'string')
            return undefined;
        // Deliberately conservative: only a literal command inside a direct
        // tools.bash({ command: '...' }) call is promoted to trusted command evidence.
        // Dynamic expressions remain opaque run_code output rather than guessed facts.
        const match = /tools\.bash\s*\(\s*\{[\s\S]{0,1600}?\bcommand\s*:\s*(['"`])([\s\S]{1,1200}?)\1/u.exec(parsed.code);
        if (!match?.[2])
            return undefined;
        const command = match[2]
            .replace(/\\([\\'"`])/gu, '$1')
            .replace(/\\n/gu, '\n')
            .trim();
        return command ? { operation: 'tools.bash', command } : undefined;
    }
    catch {
        return undefined;
    }
}
function exitCodeOf(text) {
    if (!text)
        return undefined;
    const patterns = [
        /\bexitCode\s*:\s*(-?\d+)\b/iu,
        /\bEXIT(?:_CODE)?\s*[=:]\s*(-?\d+)\b/u,
        /\bexit\((-?\d+)\)/iu,
    ];
    for (const pattern of patterns) {
        const match = pattern.exec(text);
        if (!match?.[1])
            continue;
        const value = Number.parseInt(match[1], 10);
        if (Number.isSafeInteger(value))
            return value;
    }
    return undefined;
}
function compactTestResult(text) {
    if (!text)
        return undefined;
    const lines = text.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
    const selected = lines.filter((line) => /^(?:[✔✖]\s|ℹ\s+(?:tests|pass|fail|cancelled|skipped|todo)\b|EXIT(?:_CODE)?\s*[=:]|exit\(|timedOut:|exitCode:)/u.test(line));
    const summary = (selected.length > 0 ? selected : lines.slice(-8)).join('\n');
    return summary || undefined;
}
/**
 * Extract tool facts for the most recent turn only, so a resumed executor
 * never mixes a previous turn's activity into the current settlement.
 */
export function collectTurnToolFacts(events) {
    const turn = currentTurnOf(events);
    if (turn === undefined)
        return [];
    const results = new Map();
    for (const event of events) {
        if (event.type !== 'tool/result' || eventTurn(event) !== turn)
            continue;
        const data = event.data;
        const block = data?.message?.content?.[0];
        if (!data || !block?.toolCallId)
            continue;
        const isError = data.error !== undefined || block.isError === true;
        const identity = data.error ? [data.error.name, data.error.code].filter(Boolean).join(':') : '';
        const resultText = textFromToolContent(block.content).trim();
        const exitCode = exitCodeOf(resultText);
        results.set(block.toolCallId, {
            status: isError ? 'error' : 'ok',
            ...(identity ? { detail: identity } : {}),
            ...(resultText ? { result_summary: bounded(resultText, EVIDENCE_LIMITS.toolResult) } : {}),
            ...(exitCode !== undefined ? { exit_code: exitCode } : {}),
        });
    }
    const facts = [];
    for (const event of events) {
        if (event.type !== 'tool/call' || eventTurn(event) !== turn)
            continue;
        const data = event.data;
        if (!data?.name)
            continue;
        const result = data.callId ? results.get(data.callId) : undefined;
        const directCommand = commandOf(data.arguments);
        const nested = data.name === 'run_code' ? runCodeNestedBash(data.arguments) : undefined;
        const command = directCommand ?? nested?.command;
        const detail = result?.detail ?? command;
        facts.push({
            name: data.name,
            status: result?.status ?? 'unknown',
            ...(command ? { command } : {}),
            ...(nested?.operation ? { operation: nested.operation } : {}),
            ...(result?.result_summary ? { result_summary: result.result_summary } : {}),
            ...(result?.exit_code !== undefined ? { exit_code: result.exit_code } : {}),
            ...(detail ? { detail } : {}),
        });
    }
    return facts;
}
function boundTelemetry(telemetry) {
    const redacted = redactValue(telemetry);
    const out = {};
    for (const [key, value] of Object.entries(redacted)) {
        out[key] = typeof value === 'string' ? bounded(value, EVIDENCE_LIMITS.entry) : value;
    }
    return out;
}
/** Build one bounded, sanitized bundle from already-available execution facts. */
export function buildEvidenceBundle(input) {
    const changedFiles = [];
    for (const path of input.changedFiles ?? []) {
        const entry = bounded(path.trim(), EVIDENCE_LIMITS.entry);
        if (entry && !changedFiles.includes(entry))
            changedFiles.push(entry);
        if (changedFiles.length >= EVIDENCE_LIMITS.changedFiles)
            break;
    }
    const tools = [];
    for (const tool of (input.tools ?? []).slice(0, EVIDENCE_LIMITS.toolEvidence)) {
        tools.push({
            name: bounded(tool.name, EVIDENCE_LIMITS.entry),
            status: tool.status,
            ...(tool.detail ? { detail: bounded(tool.detail, EVIDENCE_LIMITS.entry) } : {}),
            ...(tool.operation ? { operation: bounded(tool.operation, EVIDENCE_LIMITS.entry) } : {}),
            ...(tool.result_summary ? { result_summary: bounded(tool.result_summary, EVIDENCE_LIMITS.toolResult) } : {}),
            ...(tool.exit_code !== undefined ? { exit_code: tool.exit_code } : {}),
        });
    }
    const tests = [];
    for (const tool of input.tools ?? []) {
        if (tool.command === undefined || !isTestCommand(tool.command))
            continue;
        const resultSummary = compactTestResult(tool.result_summary);
        tests.push({
            command: bounded(tool.command, EVIDENCE_LIMITS.entry),
            status: tool.status,
            ...(resultSummary ? { result_summary: bounded(resultSummary, EVIDENCE_LIMITS.toolResult) } : {}),
            ...(tool.exit_code !== undefined ? { exit_code: tool.exit_code } : {}),
        });
        if (tests.length >= EVIDENCE_LIMITS.testEvidence)
            break;
    }
    const summary = input.executorOutput ? bounded(input.executorOutput, EVIDENCE_LIMITS.executorSummary) : '';
    return {
        ...(input.settlement ? { settlement: input.settlement } : {}),
        ...(summary ? { executor_summary: summary } : {}),
        changed_files: changedFiles,
        tools,
        tests,
        ...(input.telemetry ? { telemetry: boundTelemetry(input.telemetry) } : {}),
    };
}
/**
 * Render execution evidence with provenance labels. Tool/test facts are
 * deterministic projections of settled DSH events; executor_summary remains
 * model-authored and is never promoted to trusted evidence.
 */
export function formatEvidenceBundle(bundle) {
    const { executor_summary: executorSummary, ...trusted } = bundle;
    return bounded([
        '[TRUSTED_TOOL_EVENTS]',
        JSON.stringify(trusted),
        '[EXECUTOR_SUMMARY_UNVERIFIED]',
        executorSummary ?? '',
    ].join('\n'), EVIDENCE_LIMITS.total);
}
/** Persist only compact result facts, never a child transcript. */
export function buildStepResult(stepId, attempt, bundle, tests = []) {
    return {
        step_id: bounded(stepId, 80),
        attempt,
        summary: bounded(bundle.executor_summary ?? '', EVIDENCE_LIMITS.executorSummary),
        changed_files: bundle.changed_files.map((entry) => bounded(entry, EVIDENCE_LIMITS.entry)).slice(0, EVIDENCE_LIMITS.changedFiles),
        test_summary: [...tests, ...bundle.tests.map((entry) => {
                const parts = [
                    `${entry.command}: ${entry.status}`,
                    ...(entry.exit_code !== undefined ? [`exit=${entry.exit_code}`] : []),
                    ...(entry.result_summary ? [entry.result_summary] : []),
                ];
                return parts.join(' | ');
            })]
            .slice(0, EVIDENCE_LIMITS.testEvidence).map((entry) => bounded(entry, EVIDENCE_LIMITS.entry)),
        evidence: formatEvidenceBundle(bundle),
    };
}
/** Fair per-step quotas keep every step visible in a bounded final review. */
export function formatStepResults(state) {
    const steps = state.plan.steps;
    const quota = Math.max(1, Math.floor(EVIDENCE_LIMITS.total / Math.max(1, steps.length)) - 100);
    return steps.map((step) => {
        const result = state.step_results?.find((entry) => entry.step_id === step.id);
        const content = result === undefined ? '未记录持久化结果' : JSON.stringify({
            summary: result.summary, test_summary: result.test_summary, changed_files: result.changed_files, evidence: result.evidence,
        });
        return `${bounded(step.id, 80)}[${step.status}] ${bounded(content, quota)}`;
    }).join('\n');
}
