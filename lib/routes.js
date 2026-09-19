/** Effective route resolution for a new Orbit run. */
export function projectionRegistryOf(ctx) {
    const reflect = ctx?.reflect;
    const registry = reflect?.get('sessionProjections');
    return registry !== null && typeof registry === 'object' ? registry : undefined;
}
export function sessionModelStateOf(ctx, session) {
    const state = projectionRegistryOf(ctx)?.stateOf?.(session, 'modelSelection');
    return state !== null && typeof state === 'object' ? state : undefined;
}
/** Read-only access to DSH's deployment model selection. */
export function agentDefaultSelectionOf(ctx) {
    const reflect = ctx?.reflect;
    const service = reflect?.get('agentDefaultModel');
    if (service?.currentSelection === undefined)
        return undefined;
    try {
        const selection = service.currentSelection();
        return selection !== null && typeof selection === 'object' ? selection : undefined;
    }
    catch {
        return undefined;
    }
}
/** DSH selection intent: pending choice, last request, then deployment default. */
export function sessionModelSelectionOf(sources) {
    const pending = sources.sessionModel?.pending;
    if (pending !== undefined && pending !== null)
        return pending;
    const header = sources.requestHeader;
    if (header?.config !== undefined) {
        const effort = header.config.reasoningEffort;
        const adapterDefaultEffort = header.adapterDefaults?.reasoningEffort === true;
        return {
            provider: header.config.provider,
            model: header.config.model,
            ...(effort === undefined || effort === '' || adapterDefaultEffort ? {} : { reasoningEffort: effort }),
        };
    }
    return sources.agentDefault;
}
/** Normalize a user-owned selection; whitespace and malformed effort are invalid. */
export function routeFromSelection(selection) {
    if (selection === undefined)
        return undefined;
    const provider = typeof selection.provider === 'string' ? selection.provider.trim() : '';
    const model = typeof selection.model === 'string' ? selection.model.trim() : '';
    if (provider === '' || model === '')
        return undefined;
    const effort = selection.reasoningEffort;
    if (effort !== undefined && typeof effort !== 'string')
        return undefined;
    return {
        provider,
        model,
        ...(typeof effort === 'string' && effort.trim() !== '' ? { reasoningEffort: effort.trim() } : {}),
    };
}
const ROLE_LABELS = {
    commander: 'Commander',
    executor: 'Executor',
    watchdog: 'Watchdog',
};
/** Resolve all three routes or fail before a durable run is created. */
export function resolveEffectiveRoutes(input) {
    const routes = {
        commander: routeFromSelection(input.settings?.commander) ?? routeFromSelection(input.configRoutes?.commander),
        executor: input.hasSession === true || input.sessionSelection !== undefined
            ? routeFromSelection(input.sessionSelection)
            : routeFromSelection(input.configRoutes?.executor),
        watchdog: routeFromSelection(input.settings?.watchdog) ?? routeFromSelection(input.configRoutes?.watchdog),
    };
    const missing = ['commander', 'executor', 'watchdog'].filter((role) => routes[role] === undefined);
    if (missing.length > 0) {
        throw new Error(`ORBIT_ROLE_MODEL_CONFIGURATION_REQUIRED: Orbit 尚未完成角色模型配置：${missing.map((role) => `${ROLE_LABELS[role]} 未选择`).join('；')}。` +
            '请先在 Orbit 模型菜单中选择；无 Web 设置界面的 profile 可显式配置 routes。');
    }
    return structuredClone(routes);
}
export function sessionSelectionOf(agent) {
    return agent?.session?.requestHeader?.()?.config;
}
