// lib/result.ts
// Result pattern for services (authoritative) + actions (return .toPlain()).
// - Fully serializable output
// - Typed error codes
// - No any/unknown
// - Minimal + fast

/** JSON-serializable types (safe for Server Actions return values) */
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type ResultErrorCode =
    | "VALIDATION_ERROR"
    | "UNAUTHORIZED"
    | "FORBIDDEN"
    | "NOT_FOUND"
    | "CONFLICT"
    | "RATE_LIMITED"
    | "BAD_REQUEST"
    | "INTERNAL_ERROR";

export type ResultError = Readonly<{
    code: ResultErrorCode;
    /** Optional structured details for logging/UI (must be JSON-serializable) */
    details?: JsonValue;
}>;

export type ResultData<T> = Readonly<{
    success: boolean;
    message: string;
    data?: T;
    error?: ResultError;
}>;

export class Result<T> {
    readonly success: boolean;
    readonly message: string;
    readonly data?: T;
    readonly error?: ResultError;

    private constructor(args: ResultData<T>) {
        this.success = args.success;
        this.message = args.message;
        this.data = args.data;
        this.error = args.error;
        Object.freeze(this);
    }

    // -----------------------------
    // Factories
    // -----------------------------
    static ok<T>(data?: T, message = "Success"): Result<T> {
        return new Result<T>({ success: true, message, data });
    }

    static fail(
        message = "Error",
        error: ResultError = { code: "INTERNAL_ERROR" }
    ): Result<never> {
        return new Result<never>({ success: false, message, error });
    }

    // Common failures (nice + consistent)
    static badRequest(message = "Bad request", details?: JsonValue): Result<never> {
        return Result.fail(message, { code: "BAD_REQUEST", details });
    }

    static validation(message = "Validation error", details?: JsonValue): Result<never> {
        return Result.fail(message, { code: "VALIDATION_ERROR", details });
    }

    static unauthorized(message = "Unauthorized", details?: JsonValue): Result<never> {
        return Result.fail(message, { code: "UNAUTHORIZED", details });
    }

    static forbidden(message = "Forbidden", details?: JsonValue): Result<never> {
        return Result.fail(message, { code: "FORBIDDEN", details });
    }

    static notFound(message = "Not found", details?: JsonValue): Result<never> {
        return Result.fail(message, { code: "NOT_FOUND", details });
    }

    static conflict(message = "Conflict", details?: JsonValue): Result<never> {
        return Result.fail(message, { code: "CONFLICT", details });
    }

    static rateLimited(message = "Rate limited", details?: JsonValue): Result<never> {
        return Result.fail(message, { code: "RATE_LIMITED", details });
    }

    static internal(message = "An unexpected error occurred", details?: JsonValue): Result<never> {
        return Result.fail(message, { code: "INTERNAL_ERROR", details });
    }

    // -----------------------------
    // Helpers
    // -----------------------------
    get isOk(): boolean {
        return this.success;
    }

    get isFail(): boolean {
        return !this.success;
    }

    /** Convert class instance -> plain JSON-serializable object (Server Actions safe) */
    toPlain(): ResultData<T> {
        // keep shape stable (avoid spreading undefined fields)
        const base: ResultData<T> = { success: this.success, message: this.message };
        if (this.success) {
            return this.data === undefined ? base : { ...base, data: this.data };
        }
        return this.error ? { ...base, error: this.error } : base;
    }

    /** Map success data while keeping Result semantics */
    map<U>(fn: (value: T) => U): Result<U> {
        if (!this.success) return this as unknown as Result<U>;
        // success=true implies data may still be undefined, so guard
        return Result.ok(fn(this.data as T), this.message);
    }

    /** Like map, but async */
    async mapAsync<U>(fn: (value: T) => Promise<U>): Promise<Result<U>> {
        if (!this.success) return this as unknown as Result<U>;
        const out = await fn(this.data as T);
        return Result.ok(out, this.message);
    }

    /** Execute side-effect on success without changing the result */
    tap(fn: (value: T) => void): Result<T> {
        if (this.success) fn(this.data as T);
        return this;
    }
}
