/** Durable Orbit state and decision vocabulary. */
export const ORBIT_SCHEMA_VERSION = 4;
export const COMMANDER_SOFT_DEADLINE_MS = 6 * 60_000;
export const COMMANDER_EXTENSION_MS = 4 * 60_000;
export const COMMANDER_HARD_CEILING_MS = 14 * 60_000;
export const EXECUTOR_TIMEOUT_MS = 8 * 60_000;
export const WATCHDOG_TIMEOUT_MS = 2 * 60_000;
export const GUARD_ESCALATION_THRESHOLD = 3;
export const GUARD_RECOVERY_CAP = 4;
export const MAX_CORRECTION_DEPTH = 2;
export const MAX_WATCHDOG_CALLS_PER_STEP = 2;
export const MAX_EXECUTOR_INTERRUPT_RETRIES = 2;
export const MAX_PLAN_STEPS = 5;
export const MIN_PLAN_STEPS = 1;
export const MIN_MOA_CANDIDATES = 2;
export const MAX_MOA_CANDIDATES = 4;
export const DEFAULT_MOA_CANDIDATES = 3;
export const DEFAULT_MAX_MOA_STEPS = 2;
export const DEFAULT_LOOP_BUDGET = 5;
/** Automatic runs reserve two bounded execution slots beyond the accepted base plan. */
export const AUTOMATIC_LOOP_RECOVERY_RESERVE = 2;
export const MAX_AUTOMATIC_LOOP_BUDGET = MAX_PLAN_STEPS + AUTOMATIC_LOOP_RECOVERY_RESERVE;
export const GUARD_FIRST_INSTRUCTION = '请改用更安全的方法继续当前任务，不要原样重试刚被阻断的操作。';
export const GUARD_REPEAT_INSTRUCTION = '同一操作再次被阻断。请停止重复，并选择不同的安全方案。';
export const GUARD_RETRY_INSTRUCTION = '之前的方案反复触发 Orbit 安全护栏。请改用不同的安全方案，不要重试被阻断的操作。';
export const GUARD_NEEDS_USER_INSTRUCTION = '受限操作可能是完成目标所必需的。Orbit 已暂停并等待用户指引。';
export const DEFAULT_CAPABILITIES = ['filesystem', 'shell', 'web', 'browser'];
