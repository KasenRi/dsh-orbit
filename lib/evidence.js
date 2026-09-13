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
        results.set(block.toolCallId, {
            status: isError ? 'error' : 'ok',
            ...(identity ? { detail: identity } : {}),
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
        const command = commandOf(data.arguments);
        const detail = result?.detail ?? command;
        facts.push({
            name: data.name,
            status: result?.status ?? 'unknown',
            ...(command ? { command } : {}),
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
        });
    }
    const tests = [];
    for (const tool of input.tools ?? []) {
        if (tool.command === undefined || !isTestCommand(tool.command))
            continue;
        tests.push({ command: bounded(tool.command, EVIDENCE_LIMITS.entry), status: tool.status });
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
/** Render a bundle for a prompt, hard-capped at the total evidence budget. */
export function formatEvidenceBundle(bundle) {
    return bounded(JSON.stringify(bundle), EVIDENCE_LIMITS.total);
}
