import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { redactValue } from "./sanitize.js";
import { ORBIT_SCHEMA_VERSION } from "./types.js";
const LOCK_TIMEOUT_MS = 5_000;
const LOCK_STALE_MS = 30_000;
const LOCK_SPIN_MS = 20;
export function driverOwnershipFor(phase, status) {
    if (['SUCCESS', 'STOPPED', 'BUDGET_EXHAUSTED'].includes(phase) || ['success', 'stopped', 'budget_exhausted'].includes(status)) {
        return 'CLOSED';
    }
    return phase === 'NEEDS_USER' || status === 'needs_user' ? 'AWAITING_USER' : 'ACTIVE';
}
function nowIso() {
    return new Date().toISOString();
}
/**
 * Project-scoped durable store for `.cx/state.json`.
 * Atomic write + short-transaction directory lock + monotonic revision.
 */
export class OrbitStateStore {
    stateDir;
    lockDepth = 0;
    onWrite;
    constructor(projectDir, onWrite) {
        this.stateDir = join(projectDir, '.cx');
        this.onWrite = onWrite;
    }
    get statePath() {
        return join(this.stateDir, 'state.json');
    }
    transact(operation) {
        if (this.lockDepth > 0)
            return operation();
        mkdirSync(this.stateDir, { recursive: true, mode: 0o700 });
        const lock = join(this.stateDir, 'controller.lock');
        const deadline = Date.now() + LOCK_TIMEOUT_MS;
        for (;;) {
            try {
                mkdirSync(lock, { mode: 0o700 });
                writeFileSync(join(lock, 'owner.json'), JSON.stringify({ pid: process.pid, hostname: hostname(), acquired_at: nowIso() }), { mode: 0o600 });
                break;
            }
            catch (error) {
                if (error?.code !== 'EEXIST')
                    throw error;
                if (isStale(lock) || Date.now() > deadline) {
                    if (Date.now() > deadline && !isStale(lock))
                        throw new Error('ORBIT_STATE_LOCK_TIMEOUT: another controller transaction is active');
                    rmSync(lock, { recursive: true, force: true });
                    continue;
                }
                sleepSync(LOCK_SPIN_MS);
            }
        }
        this.lockDepth += 1;
        try {
            return operation();
        }
        finally {
            this.lockDepth -= 1;
            rmSync(lock, { recursive: true, force: true });
        }
    }
    readRawState() {
        if (!existsSync(this.statePath))
            return null;
        let parsed;
        try {
            parsed = JSON.parse(readFileSync(this.statePath, 'utf8'));
        }
        catch (error) {
            throw new Error(`ORBIT_STATE_INVALID: 无法解析 ${this.statePath}：${error instanceof Error ? error.message : String(error)}`);
        }
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error(`ORBIT_STATE_INVALID: ${this.statePath} 不是有效的对象状态。`);
        }
        const schema = parsed['schema_version'];
        if (typeof schema === 'number' && schema > ORBIT_SCHEMA_VERSION) {
            throw new Error(`ORBIT_STATE_SCHEMA_UNSUPPORTED: ${this.statePath} 使用未来 schema_version=${schema}。`);
        }
        return parsed;
    }
    readState() {
        const raw = this.readRawState();
        if (raw === null)
            return null;
        return raw;
    }
    writeState(state) {
        const next = this.transact(() => {
            const current = this.readRawState();
            const revision = Number(current?.['state_revision'] ?? 0) + 1;
            const updated = {
                ...state,
                schema_version: ORBIT_SCHEMA_VERSION,
                state_revision: revision,
                driver_ownership: driverOwnershipFor(state.phase, state.status),
                updated_at: nowIso(),
            };
            Object.assign(state, updated);
            this.writeJson(this.statePath, updated);
            return updated;
        });
        try {
            this.onWrite?.(next);
        }
        catch { /* UI projection must never veto durable state. */ }
        return next;
    }
    writeJson(filePath, value) {
        mkdirSync(dirname(filePath), { recursive: true, mode: 0o700 });
        const temp = `${filePath}.${randomUUID()}.tmp`;
        writeFileSync(temp, `${JSON.stringify(redactValue(value), null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
        renameSync(temp, filePath);
    }
}
function isStale(lock) {
    try {
        const owner = JSON.parse(readFileSync(join(lock, 'owner.json'), 'utf8'));
        if (typeof owner.pid === 'number') {
            try {
                process.kill(owner.pid, 0);
            }
            catch {
                return true;
            }
        }
        const acquired = Date.parse(owner.acquired_at ?? '');
        if (!Number.isNaN(acquired) && Date.now() - acquired > LOCK_STALE_MS)
            return true;
        statSync(lock);
        return false;
    }
    catch {
        return true;
    }
}
function sleepSync(ms) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
