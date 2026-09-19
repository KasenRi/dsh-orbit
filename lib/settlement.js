/**
 * Settlement classification for Orbit executor/commander children.
 *
 * The durable seam is the session `turn/end` event: its `data.reason.kind` is
 * `completed | aborted | error | blocked | max-tokens` (`interrupted` only
 * appears on cold-read synthesis). A child that is merely `idle` is NOT success.
 */
import { truncateSafe } from "./sanitize.js";
export function classifyTurnSettlement(events) {
    let end;
    for (let index = events.length - 1; index >= 0; index -= 1) {
        if (events[index]?.type === 'turn/end') {
            end = events[index];
            break;
        }
    }
    if (!end)
        return { settlement: 'open' };
    const reason = end.data?.reason;
    switch (reason?.kind) {
        case 'completed':
            return { settlement: 'completed' };
        case 'aborted':
            return { settlement: 'aborted', ...(reason.reason?.kind ? { cancelCause: reason.reason.kind } : {}) };
        case 'error':
            return { settlement: 'error', ...(reason.error?.message ? { errorMessage: truncateSafe(reason.error.message, 500) } : {}) };
        case 'blocked':
            return { settlement: 'blocked' };
        case 'max-tokens':
            return { settlement: 'max-tokens' };
        case 'interrupted':
            return { settlement: 'interrupted' };
        default:
            return { settlement: 'open' };
    }
}
