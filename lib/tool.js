import { defineTool } from '@deepseek-ai/dsh-tools';
export const ORBIT_TOOL_NAME = 'orbit_controller';
/** Legacy tool name kept as a backward-compatible alias. */
export const LEGACY_CX_TOOL_NAME = 'cx_controller';
const TOOL_DESCRIPTION = 'Drive Orbit engineering autonomy for the current project. Orbit runs a deterministic Supervisor ' +
    '(Commander -> Executor -> Smart Watchdog) over a durable .cx/state.json. Use action "run" with a ' +
    'goal to start or continue, "resume" to continue a persisted run, "status" to inspect, "stop" to ' +
    'close the run, and "doctor" to check the environment. Only Orbit writes .cx durable state.';
const LEGACY_TOOL_DESCRIPTION = `Legacy compatibility alias. Prefer ${ORBIT_TOOL_NAME}. ${TOOL_DESCRIPTION}`;
function summarize(result) {
    const lines = [`orbit ${result.action}: ok=${result.ok} phase=${result.phase ?? '-'} status=${result.status ?? '-'}`];
    if (result.run_id)
        lines.push(`run_id: ${result.run_id}`);
    if (result.message)
        lines.push(`message: ${result.message}`);
    const data = result.data;
    if (data) {
        if (data['loop'])
            lines.push(`loop: ${JSON.stringify(data['loop'])}`);
        if (data['current_step'])
            lines.push(`current_step: ${JSON.stringify(data['current_step'])}`);
        if (data['last_error'])
            lines.push(`last_error: ${JSON.stringify(data['last_error'])}`);
        if (Array.isArray(data['plan']))
            lines.push(`plan: ${JSON.stringify(data['plan'])}`);
    }
    return lines.join('\n');
}
/**
 * One tool implementation shared by the canonical `orbit_controller` tool and
 * the legacy `cx_controller` alias. Both names call the same OrbitService.
 */
export function createOrbitTool(ctx, options = {}) {
    const legacy = options.legacy === true;
    return defineTool({
        name: legacy ? LEGACY_CX_TOOL_NAME : ORBIT_TOOL_NAME,
        description: legacy ? LEGACY_TOOL_DESCRIPTION : TOOL_DESCRIPTION,
        parameters: {
            action: { type: 'string', required: true, enum: ['run', 'start', 'resume', 'stop', 'status', 'doctor'] },
            goal: { type: 'string', description: 'The engineering goal (required for run/start).' },
            preset: { type: 'string', description: 'Run preset id.' },
            approved_loop_count: { type: 'integer', description: 'Explicit loop budget (positive, <= 10).' },
            run_id: { type: 'string', description: 'Target run id for resume/stop.' },
            user_hard_constraints: { type: 'array', items: { type: 'string' } },
            github_allowed: { type: 'boolean', description: 'Allow GitHub remote writes for this run.' },
        },
        output: {
            schema: { type: 'json' },
            render: (_args, value) => {
                const result = value;
                return [{ type: 'text', text: summarize(result) }];
            },
        },
        async execute(args, exec) {
            // The service is provided by this plugin's own fiber; reading it through
            // `agent.ctx` would require an inject declaration on the agent scope.
            const scope = ctx;
            const service = scope.orbit ?? scope.cx;
            if (!service)
                throw new Error('orbit service is unavailable; dsh-orbit is not loaded.');
            const agent = exec.agent;
            const cwd = agent?.session?.header?.cwd ?? process.cwd();
            const input = {
                ...(args.goal !== undefined ? { goal: args.goal } : {}),
                ...(args.preset !== undefined ? { preset: args.preset } : {}),
                ...(args.approved_loop_count !== undefined ? { approved_loop_count: args.approved_loop_count } : {}),
                ...(args.run_id !== undefined ? { run_id: args.run_id } : {}),
                ...(args.user_hard_constraints !== undefined ? { user_hard_constraints: args.user_hard_constraints } : {}),
                ...(args.github_allowed !== undefined ? { github_allowed: args.github_allowed } : {}),
            };
            if (args.action === 'status')
                return (await service.status(cwd));
            if (args.action === 'stop')
                return service.stop(args.run_id, cwd);
            if (args.action === 'doctor')
                return (await service.doctor(cwd));
            if (args.action === 'resume')
                return (await service.resume(input, cwd, exec.signal));
            return (await service.run(input, cwd, exec.signal));
        },
    });
}
