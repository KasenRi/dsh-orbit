/** Secret redaction shared by Orbit state, logs, and watchdog prompts. */
const SECRET_PATTERNS = [
    /(authorization\s*:\s*(?:bearer\s+)?)[^\s,;]+/gi,
    /((?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|passwd|cookie|secret|private[_-]?key)\s*[=:]\s*)[^\s,;]+/gi,
    /(\b(?:sk|pk|ghp|github_pat)_[A-Za-z0-9_-]{8,})/g,
    /(\bBearer\s+)[A-Za-z0-9._-]+/gi,
];
const SENSITIVE_KEY = /^(?:password|passwd|cookie|secret|authorization|bearer|private[_-]?key|api[_-]?key|access[_-]?token|refresh[_-]?token|token|github[_-]?token|gh[_-]?token|credential)$/i;
export function redactText(value) {
    let result = value;
    for (const pattern of SECRET_PATTERNS)
        result = result.replace(pattern, '$1[REDACTED]');
    return result;
}
export function redactValue(value, key) {
    if (key !== undefined && SENSITIVE_KEY.test(key))
        return '[REDACTED]';
    if (Array.isArray(value))
        return value.map((item) => redactValue(item));
    if (value !== null && typeof value === 'object') {
        const out = {};
        for (const [childKey, childValue] of Object.entries(value)) {
            out[childKey] = redactValue(childValue, childKey);
        }
        return out;
    }
    if (typeof value === 'string')
        return redactText(value);
    return value;
}
export function truncateSafe(value, max = 4000) {
    const redacted = redactText(value);
    if (redacted.length <= max)
        return redacted;
    return `${redacted.slice(0, max)}\n...[truncated]`;
}
export function looksLikeSecretKey(key) {
    return SENSITIVE_KEY.test(key);
}
