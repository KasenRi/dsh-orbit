/**
 * Per-Session Orbit enable state, native to DeepSeek Harness.
 *
 * The write is the ordinary `/orbit-toggle on|off` command: the commands
 * runtime appends its own `command/run` record to the Session log (a known
 * event type, durable with the Session). The state is a session projection
 * unit folding those records, so it is per-Session by construction, survives
 * reloads with the log, and reaches the browser through the normal projection
 * wire — no separate store, no Orbit settings entry, no `.cx/state.json`.
 *
 * This is UI/runtime preference state for one chat, never the durable
 * execution state of an Orbit run.
 */
/** The command whose `command/run` records carry the toggle. */
export const ORBIT_TOGGLE_COMMAND = 'orbit-toggle';
/** The projection key carrying the per-Session enable state. */
export const ORBIT_SESSION_KEY = 'orbitSession';
/**
 * Parse one `/orbit-toggle` argument; `undefined` when it names neither state,
 * so a malformed toggle never flips the switch as a side effect.
 */
export function parseOrbitToggle(rawInput) {
    const argument = rawInput.trim().toLowerCase();
    if (argument === 'on')
        return true;
    if (argument === 'off')
        return false;
    return undefined;
}
/**
 * Fold one Session event into the enable state. A new Session starts OFF;
 * every unrelated event keeps the same state reference so the projection
 * drive does no downstream work.
 */
export function foldOrbitSession(state, event) {
    if (event.type !== 'command/run')
        return state;
    const data = event.data;
    if (data?.name !== ORBIT_TOGGLE_COMMAND)
        return state;
    const enabled = parseOrbitToggle(typeof data.args === 'string' ? data.args : '');
    if (enabled === undefined || enabled === state.enabled)
        return state;
    return { enabled };
}
/**
 * Minimal `ZodType`-shaped validator for the projection schemas. The registry
 * only ever calls `parse`, and Orbit must not add a `zod` runtime dependency
 * that a strict package manager would not hoist for the plugin.
 */
function orbitSessionSchema() {
    return {
        parse(value) {
            const enabled = value?.enabled;
            if (typeof enabled !== 'boolean')
                throw new Error('orbitSession projection value must be { enabled: boolean }');
            return { enabled };
        },
    };
}
/** Register the per-Session enable projection on the session projection registry. */
export function installOrbitSessionProjection(ctx) {
    ctx.sessionProjections.register({
        key: ORBIT_SESSION_KEY,
        stateSchema: orbitSessionSchema(),
        init: () => ({ enabled: false }),
        apply: (state, event) => foldOrbitSession(state, event),
        wire: {
            viewSchema: orbitSessionSchema(),
            view: (state) => ({ enabled: state.enabled }),
        },
        stateVersion: 1,
    });
}
/** Whether the Session currently defaults ordinary messages into Orbit. */
export function orbitEnabledOf(ctx, session) {
    const reflect = ctx.reflect;
    const registry = reflect?.get('sessionProjections');
    return registry?.stateOf(session, ORBIT_SESSION_KEY)?.enabled === true;
}
