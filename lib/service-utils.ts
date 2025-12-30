// lib/service-utils.ts

/** JSON-safe error for perf logger + Result */
export function toError(e: unknown): Error {
    if (e instanceof Error) return e;
    return new Error(typeof e === "string" ? e : "Unknown error");
}

/** prevent %/_ wildcard injection for ILIKE */
export function escapeLike(s: string) {
    return s.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

/** Cursor payload shared format */
export type CursorPayload = { value: string; id: number };

/** Parse cursor string; supports JSON cursor or legacy value-only cursor */
export function parseCursor(cursor: string): CursorPayload {
    try {
        const parsed = JSON.parse(cursor) as CursorPayload;
        if (parsed && typeof parsed.value === "string" && typeof parsed.id === "number") return parsed;
    } catch { }
    return { value: cursor, id: 0 };
}

/** Build next cursor string (JSON) */
export function encodeCursor(value: string, id: number) {
    return JSON.stringify({ value, id } satisfies CursorPayload);
}
