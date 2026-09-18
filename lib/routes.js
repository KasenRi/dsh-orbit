/**
 * Effective route resolution for a new Orbit run.
 *
 * Orbit stores only Commander and Watchdog itself (`orbit` settings namespace,
 * falling back to the composition `config.routes`). The Executor follows the
 * initiating Session's current model selection, read from the durable
 * `modelSelection` projection (the user's pending choice first, then the model
 * that actually served the last request) with the request-header seam and
 * `config.routes.executor` as compatibility fallbacks (headless, CLI, minimal
 * profiles, tests). Resolution happens exactly once per new run and is frozen
 * into `state.routes`.
 */
/**
 * Resolve the optional session projection registry without an inject
 * declaration, exactly like the goal-driver lookup: minimal compositions
 * without the registry simply have no durable model selection.
 * @param ctx - any context whose `reflect` service lookup is available.
 * @returns the registry, or undefined when the composition omits it.
 */
export function projectionRegistryOf(ctx) {
    const reflect = ctx?.reflect;
    const registry = reflect?.get('sessionProjections');
    return registry !== null && typeof registry === 'object' ? registry : undefined;
}
/**
 * Read one Session's durable model-selection state (`modelSelection` unit).
 * @param ctx - context carrying the projection registry.
 * @param session - the initiating Session, when one exists.
 * @returns the projection state, or undefined when it is unavailable.
 */
export function sessionModelStateOf(ctx, session) {
    const state = projectionRegistryOf(ctx)?.stateOf?.(session, 'modelSelection');
    return state !== null && typeof state === 'object' ? state : undefined;
}
/**
 * Normalize one provider/model/effort candidate into a complete route.
 * @param selection - candidate fields from settings, the session model, or tests.
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
 * Commander = settings (base = config) → config; Executor = session model
 * (pending → lastUsed) → request header → config; Watchdog = settings
 * (base = config) → config.
 * @param input - config fallback, settings section, and session model state.
 * @returns the complete frozen route set.
 */
export function resolveEffectiveRoutes(input) {
    return {
        commander: routeFromSelection(input.settings?.commander) ?? input.configRoutes.commander,
        executor: routeFromSelection(input.sessionModel?.pending ?? undefined) ??
            routeFromSelection(input.sessionModel?.lastUsed ?? undefined) ??
            routeFromSelection(input.sessionSelection) ??
            input.configRoutes.executor,
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
