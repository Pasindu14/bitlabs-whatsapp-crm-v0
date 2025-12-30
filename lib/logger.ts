// lib/logger.ts
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type PerfContext = Record<string, JsonValue>;

export type PerformanceMetrics = Readonly<
  PerfContext & {
    operation: string;
    durationMs: number;
    success: boolean;
    recordCount?: number;
    error?: string;
    tags?: string[];
  }
>;

export interface LoggerOptions {
  context?: PerfContext;
  slowThresholdMs?: number;
  silent?: boolean;
  tags?: string[];
}

export function logServerError(context: string, error: Error | string): void {
  if (process.env.NODE_ENV === "development") {
    console.error(`[${context}]`, error);
  }
}

function toErrorMessage(e: Error | string): string {
  return typeof e === "string" ? e : e.message;
}

function getNowMs(): number {
  // Prefer high-res timer on Node/browser
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function isPlainObject(value: JsonValue): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class PerformanceLogger {
  private readonly start: number;
  private readonly operation: string;
  private readonly context: PerfContext;
  private readonly slowThresholdMs: number;
  private readonly silent: boolean;
  private readonly tags: string[];
  private checkpoints: Map<string, number> = new Map();

  constructor(operation: string, options: LoggerOptions = {}) {
    this.operation = operation;
    this.context = options.context ?? {};
    this.slowThresholdMs = options.slowThresholdMs ?? 1000;
    this.silent = options.silent ?? false;
    this.tags = options.tags ?? [];
    this.start = getNowMs();
  }

  /**
   * Record an intermediate checkpoint
   */
  checkpoint(label: string): number {
    const elapsed = Math.round(getNowMs() - this.start);
    this.checkpoints.set(label, elapsed);
    return elapsed;
  }

  /**
   * Get all recorded checkpoints
   */
  getCheckpoints(): Record<string, number> {
    return Object.fromEntries(this.checkpoints);
  }

  complete(recordCount?: number, extra: PerfContext = {}): PerformanceMetrics {
    const durationMs = Math.round(getNowMs() - this.start);
    
    const metrics: PerformanceMetrics = Object.freeze({
      operation: this.operation,
      durationMs,
      success: true,
      ...(recordCount !== undefined ? { recordCount } : {}),
      ...(this.tags.length > 0 ? { tags: this.tags } : {}),
      ...(this.checkpoints.size > 0 ? { checkpoints: this.getCheckpoints() } : {}),
      ...this.context,
      ...extra,
    });

    this.log(metrics);
    return metrics;
  }

  fail(error: Error | string, extra: PerfContext = {}): PerformanceMetrics {
    const durationMs = Math.round(getNowMs() - this.start);
    
    const metrics: PerformanceMetrics = Object.freeze({
      operation: this.operation,
      durationMs,
      success: false,
      error: toErrorMessage(error),
      ...(this.tags.length > 0 ? { tags: this.tags } : {}),
      ...(this.checkpoints.size > 0 ? { checkpoints: this.getCheckpoints() } : {}),
      ...this.context,
      ...extra,
    });

    this.log(metrics, true);
    return metrics;
  }

  private log(metrics: PerformanceMetrics, isError = false): void {
    if (this.silent) return;

    const isSlow = metrics.durationMs > this.slowThresholdMs;
    const isDev = process.env.NODE_ENV === "development";

    // Production: only log errors and slow operations
    if (!isDev) {
      if (isError) {
        console.error(`[PERF-ERROR] ${metrics.operation}`, metrics);
      } else if (isSlow) {
        console.warn(`[PERF-SLOW] ${metrics.operation}`, metrics);
      }
      return;
    }

    // Development: detailed logging with emojis
    const timestamp = new Date().toISOString();
    const enrichedMetrics = {
      ...metrics,
      timestamp,
      isSlow,
    };

    if (isError) {
      console.error(`🔴 [PERF-ERROR] ${metrics.operation}`, enrichedMetrics);
    } else if (isSlow) {
      console.warn(`🟡 [PERF-SLOW] ${metrics.operation}`, enrichedMetrics);
    } else {
      console.log(`🟢 [PERF] ${metrics.operation}`, {
        durationMs: metrics.durationMs,
        recordCount: metrics.recordCount ?? 0,
        tags: metrics.tags,
      });
    }
  }
}

/**
 * Factory function for creating performance loggers
 */
export function createPerformanceLogger(
  operation: string,
  options: LoggerOptions = {}
): PerformanceLogger {
  return new PerformanceLogger(operation, options);
}

/**
 * Async wrapper that automatically logs performance
 */
export async function withPerformanceLogging<T>(
  operation: string,
  fn: () => Promise<T>,
  options: LoggerOptions = {}
): Promise<T> {
  const logger = new PerformanceLogger(operation, options);
  try {
    const result = await fn();
    logger.complete();
    return result;
  } catch (error) {
    logger.fail(error as Error);
    throw error;
  }
}

/**
 * Sync wrapper that automatically logs performance
 */
export function withPerformanceLoggingSync<T>(
  operation: string,
  fn: () => T,
  options: LoggerOptions = {}
): T {
  const logger = new PerformanceLogger(operation, options);
  try {
    const result = fn();
    logger.complete();
    return result;
  } catch (error) {
    logger.fail(error as Error);
    throw error;
  }
}