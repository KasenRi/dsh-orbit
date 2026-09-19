export const EXECUTOR_READ_ONLY_TOOLS = ['read', 'read_image', 'glob', 'grep'];
export const FILESYSTEM_TOOLS = ['write', 'edit', 'str_replace_editor'];
export const SHELL_TOOLS = ['bash'];
export const WEB_TOOLS = ['web_search', 'web_fetch'];
export const READ_ONLY_ROLE_TOOLS = [...EXECUTOR_READ_ONLY_TOOLS, ...WEB_TOOLS];
const READ_ONLY_SET = new Set(EXECUTOR_READ_ONLY_TOOLS);
/** Deterministically map bounded capability ids to tool names. */
export function executorToolsFor(capabilities, browserTools, configuredReadOnly = EXECUTOR_READ_ONLY_TOOLS) {
    const tools = configuredReadOnly.filter((tool) => READ_ONLY_SET.has(tool));
    if (capabilities.includes('filesystem'))
        tools.push(...FILESYSTEM_TOOLS);
    if (capabilities.includes('shell'))
        tools.push(...SHELL_TOOLS);
    if (capabilities.includes('web'))
        tools.push(...WEB_TOOLS);
    if (capabilities.includes('browser'))
        tools.push(...browserTools);
    return [...new Set(tools)];
}
/** Tools that can mutate workspace or browser state while Orbit owns it. */
export function mutationTools(browserTools) {
    return new Set([...FILESYSTEM_TOOLS, ...SHELL_TOOLS, 'pwsh', 'apply_patch', 'delete_file', 'move_file', ...browserTools]);
}
