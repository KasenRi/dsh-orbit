/**
 * Effective route resolution for a new Orbit run.
 *
 * Orbit stores only Commander and Watchdog itself (`orbit` settings namespace,
 * falling back to the composition `config.routes`). The Executor follows the
 * initiating Session's current model selection, read through the public
 * request-header seam, and falls back to `config.routes.executor` on surfaces
 * without one (headless, CLI, minimal profiles, tests). Resolution happens
 * exactly once per new run and is frozen into `state.routes`.
 */
/**
 * Normalize one provider/model/effort candidate into a complete route.
 * @param selection - candidate fields from settings, the session header, or tests.
 * @returns the complete route, or undefined when provider/model are unusable.
 */
export function routeFromSelection(selection) {
    if (selection === undefined)
        return undefined;
    const { provider, model, reasoningEffort } = selection;
    if (typeof provider !== 'string' || provider === '')
        return undefined;
    if (typeof model !== 'string' || model === '')
        return undefined;
    return {
        provider,
        model,
        ...(typeof reasoningEffort === 'string' && reasoningEffort !== '' ? { reasoningEffort } : {}),
    };
}
/**
 * Resolve the three role routes for a NEW run:
 * Commander = settings (base = config) → config; Executor = session selection
 * → config; Watchdog = settings (base = config) → config.
 * @param input - config fallback, settings section, and session selection.
 * @returns the complete frozen route set.
 */
export function resolveEffectiveRoutes(input) {
    return {
        commander: routeFromSelection(input.settings?.commander) ?? input.configRoutes.commander,
        executor: routeFromSelection(input.sessionSelection) ?? input.configRoutes.executor,
        watchdog: routeFromSelection(input.settings?.watchdog) ?? input.configRoutes.watchdog,
    };
}
/**
 * Read the initiating Session's current model selection from the public
 * request-header seam (`Agent.session.requestHeader().config`).
 * @param agent - initiating agent, or undefined outside a boundary.
 * @returns the selection route, or undefined when no header exists.
 */
export function sessionSelectionOf(agent) {
    return routeFromSelection(agent?.session?.requestHeader?.()?.config);
}
