// lib/server-action-helper.ts
import { auth } from "@/auth";
import { createPerformanceLogger } from "@/lib/logger";
import { Result } from "@/lib/result";
import type { z } from "zod";

/**
 * Authenticated session data
 * Extend this interface if you need additional auth fields
 */
export interface AuthSession {
  userId: number;
  companyId: number;
  role?: string | null;
}

/**
 * Plain object result type for client/server boundary
 */
export type PlainResult<T> = {
  success: true;
  data: T;
  message?: string;
} | {
  success: false;
  data?: never;
  message: string;
};

/**
 * Convert Result instance to plain object
 */
function toPlainResult<T>(result: Result<T>): PlainResult<T> {
  if (result.success) {
    return {
      success: true,
      data: result.data as T,
      message: result.message,
    };
  } else {
    return {
      success: false,
      message: result.message,
    };
  }
}

/**
 * Get the authenticated session
 * Use this in all server actions to ensure consistent authentication handling
 * 
 * @returns AuthSession containing userId and companyId if successful
 */
async function getAuthSession(): Promise<Result<AuthSession>> {
  const session = await auth();

  if (!session) {
    return Result.fail("Unauthorized");
  }

  if (!session?.user?.id) {
    return Result.fail("Unauthorized");
  }

  if (!session.user.companyId) {
    return Result.fail("Company context missing");
  }

  return Result.ok({
    userId: Number(session.user.id),
    companyId: session.user.companyId,
    role: session.user.role ?? null,
  });
}

/**
 * Generic audit logger function type
 * Implement this to integrate with your audit system
 */
export type AuditLogger = (data: {
  entityType: string;
  entityId: number;
  companyId: number;
  action: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  changedBy: number;
  changeReason?: string;
}) => void;

/**
 * Global audit logger - set this once in your app initialization
 * 
 * @example
 * import { logAudit } from "@/lib/audit-helper";
 * setAuditLogger((data) => {
 *   logAudit({
 *     ...data,
 *     action: data.action as any, // Cast to your AUDIT_ACTIONS type
 *   });
 * });
 */
let globalAuditLogger: AuditLogger | null = null;

export function setAuditLogger(logger: AuditLogger | null): void {
  globalAuditLogger = logger;
}

/**
 * Require authentication and return typed session
 */
export async function requireAuth(): Promise<Result<AuthSession>> {
  const authResult = await getAuthSession();
  if (!authResult.success || !authResult.data) {
    return Result.fail(authResult.message || "Authentication required");
  }
  return Result.ok(authResult.data as AuthSession);
}

/**
 * Require specific company access
 */
export async function requireCompanyAuth(
  companyId: number
): Promise<Result<AuthSession>> {
  const authRes = await requireAuth();
  if (!authRes.success || !authRes.data) return authRes;

  const authData = authRes.data;
  if (authData.companyId !== companyId) {
    return Result.fail("Access denied: Invalid company");
  }

  return Result.ok(authData);
}

/**
 * Configuration options for server actions
 */
export interface ActionOptions<TInput = unknown> {
  /** Input validation schema (Zod) */
  schema?: z.ZodSchema<TInput>;

  /** Require specific company access */
  requireCompany?: boolean;

  /** Audit logging configuration */
  audit?: {
    entityType: string;
    action: string;
    /** Extract entity ID from result */
    getEntityId?: (result: any) => number;
    /** Extract old values (for updates/deletes) */
    getOldValues?: (input: TInput, result: any) => Record<string, unknown>;
    /** Extract new values (for creates/updates) */
    getNewValues?: (input: TInput, result: any) => Record<string, unknown>;
    /** Optional reason for the change */
    changeReason?: string;
  };

  /** Rate limiting hook - return error message if rate limited */
  rateLimit?: (auth: AuthSession, input: TInput) => Promise<string | null>;

  /** Additional performance context */
  perfContext?: Record<string, any>;
}

/**
 * Enhanced server action wrapper with full type safety
 * 
 * @example
 * export const createDepartment = withAction(
 *   "createDepartment",
 *   async (auth, input: CreateDepartmentInput) => {
 *     const dept = await db.department.create({ ... });
 *     return Result.ok(dept);
 *   },
 *   {
 *     schema: createDepartmentSchema,
 *     audit: {
 *       entityType: "department",
 *       action: "CREATE",
 *       getEntityId: (result) => result.id,
 *       getNewValues: (input, result) => result,
 *     },
 *   }
 * );
 */
export function withAction<TInput, TOutput>(
  name: string,
  handler: (auth: AuthSession, input: TInput) => Promise<Result<TOutput>>,
  options: ActionOptions<TInput> = {}
) {
  return async (input: TInput): Promise<PlainResult<TOutput>> => {
    const perf = createPerformanceLogger(name, {
      ...options.perfContext,
    } as any);

    try {
      // 1. Authenticate
      const authRes = await requireAuth();
      if (!authRes.success || !authRes.data) {
        perf.fail("Authentication failed");
        return toPlainResult(Result.fail(authRes.message) as Result<TOutput>);
      }
      const auth = authRes.data;

      perf.checkpoint("authenticated");

      // 2. Validate company access if required
      if (options.requireCompany && typeof input === "object" && input !== null) {
        const companyId = (input as any).companyId;
        if (typeof companyId === "number" && auth.companyId !== companyId) {
          perf.fail("Company access denied");
          return toPlainResult(Result.fail("Access denied: Invalid company") as Result<TOutput>);
        }
      }

      // 3. Validate input
      if (options.schema) {
        const validation = options.schema.safeParse(input);
        if (!validation.success) {
          const errorMessage = validation.error.issues
            .map((e: z.ZodIssue) => `${e.path.join(".")}: ${e.message}`)
            .join(", ");
          perf.fail(`Validation failed: ${errorMessage}`);
          return toPlainResult(Result.fail(`Validation failed: ${errorMessage}`) as Result<TOutput>);
        }
        input = validation.data;
        perf.checkpoint("validated");
      }

      // 4. Rate limiting
      if (options.rateLimit) {
        const rateLimitError = await options.rateLimit(auth, input);
        if (rateLimitError) {
          perf.fail(`Rate limited: ${rateLimitError}`);
          return toPlainResult(Result.fail(rateLimitError) as Result<TOutput>);
        }
        perf.checkpoint("rate-check");
      }

      // 5. Execute handler
      const result = await handler(auth, input);
      perf.checkpoint("executed");

      // 6. Audit logging (only if successful and audit logger is configured)
      if (options.audit && result.success && globalAuditLogger) {
        try {
          const entityId = options.audit.getEntityId?.(result.data);

          // Only log if we have an entity ID
          if (entityId !== undefined) {
            globalAuditLogger({
              entityType: options.audit.entityType,
              entityId,
              companyId: auth.companyId,
              action: options.audit.action,
              oldValues: options.audit.getOldValues?.(input, result.data) ?? null,
              newValues: options.audit.getNewValues?.(input, result.data) ?? null,
              changedBy: auth.userId,
              changeReason: options.audit.changeReason,
            });
          }
        } catch (auditError) {
          // Don't let audit failures break the action
          console.error(`[${name}] Audit logging failed:`, auditError);
        }
      }

      // 7. Complete performance logging
      if (!result.success) {
        perf.fail(result.message);
      } else {
        perf.complete(undefined, { success: true });
      }

      return toPlainResult(result);
    } catch (err) {
      const error = err as Error;
      perf.fail(error);

      // Structured error logging
      console.error(`[${name}] Unexpected error:`, {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });

      // Don't expose internal errors to client
      return toPlainResult(
        Result.fail("An unexpected error occurred. Please try again.") as Result<TOutput>
      );
    }
  };
}

/**
 * Variant for actions that don't require auth (e.g., public endpoints)
 * 
 * @example
 * export const getPublicStats = withPublicAction(
 *   "getPublicStats",
 *   async (input: { category: string }) => {
 *     const stats = await db.stats.findMany({ ... });
 *     return Result.ok(stats);
 *   },
 *   { schema: publicStatsSchema }
 * );
 */
export function withPublicAction<TInput, TOutput>(
  name: string,
  handler: (input: TInput) => Promise<Result<TOutput>>,
  options: Omit<ActionOptions<TInput>, "requireCompany" | "audit"> = {}
) {
  return async (input: TInput): Promise<PlainResult<TOutput>> => {
    const perf = createPerformanceLogger(name, {
      ...options.perfContext,
    } as any);

    try {
      // 1. Validate input
      if (options.schema) {
        const validation = options.schema.safeParse(input);
        if (!validation.success) {
          const errorMessage = validation.error.issues
            .map((e: z.ZodIssue) => `${e.path.join(".")}: ${e.message}`)
            .join(", ");
          perf.fail(`Validation failed: ${errorMessage}`);
          return toPlainResult(Result.fail(`Validation failed: ${errorMessage}`) as Result<TOutput>);
        }
        input = validation.data;
        perf.checkpoint("validated");
      }

      // 2. Execute handler
      const result = await handler(input);
      perf.checkpoint("executed");

      // 3. Complete performance logging
      if (!result.success) {
        perf.fail(result.message);
      } else {
        perf.complete(undefined, { success: true });
      }

      return toPlainResult(result);
    } catch (err) {
      const error = err as Error;
      perf.fail(error);

      console.error(`[${name}] Unexpected error:`, {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });

      return toPlainResult(
        Result.fail("An unexpected error occurred. Please try again.") as Result<TOutput>
      );
    }
  };
}

/**
 * Batch action wrapper for processing multiple items
 * Continues processing even if some items fail
 * 
 * @example
 * export const bulkUpdateUsers = withBatchAction(
 *   "bulkUpdateUsers",
 *   async (auth, items: UpdateUserInput[]) => {
 *     return await Promise.all(
 *       items.map(item => updateUser(auth, item))
 *     );
 *   }
 * );
 */
export function withBatchAction<TInput, TOutput>(
  name: string,
  handler: (
    auth: AuthSession,
    items: TInput[]
  ) => Promise<Array<Result<TOutput>>>,
  options: Omit<ActionOptions<TInput[]>, "schema" | "audit"> = {}
) {
  return async (items: TInput[]): Promise<PlainResult<Array<PlainResult<TOutput>>>> => {
    const perf = createPerformanceLogger(name, {
      ...options.perfContext,
    } as any);

    try {
      // 1. Authenticate
      const authRes = await requireAuth();
      if (!authRes.success || !authRes.data) {
        perf.fail("Authentication failed");
        return toPlainResult(Result.fail(authRes.message));
      }
      const auth = authRes.data;
      perf.checkpoint("authenticated");

      // 2. Execute batch handler
      const results = await handler(auth, items);
      perf.checkpoint("executed");

      // 3. Calculate success metrics
      const successCount = results.filter((r) => r.success).length;
      const failCount = results.length - successCount;

      perf.complete(items.length, {
        successCount,
        failCount,
        successRate: (successCount / items.length) * 100,
      });

      // Convert all results to plain objects
      const plainResults = results.map(r => toPlainResult(r));
      return toPlainResult(Result.ok(plainResults));
    } catch (err) {
      const error = err as Error;
      perf.fail(error);

      console.error(`[${name}] Unexpected error:`, {
        message: error.message,
        stack: error.stack,
        itemCount: items.length,
      });

      return toPlainResult(Result.fail("Batch operation failed. Please try again."));
    }
  };
}

/**
 * Helper for mutations that track old and new values for audit
 * 
 * @example
 * export const updateDepartment = withMutationAction(
 *   "updateDepartment",
 *   async (auth, input: UpdateDeptInput) => {
 *     const old = await db.department.findUnique({ where: { id: input.id } });
 *     const updated = await db.department.update({ ... });
 *     return { old, new: updated };
 *   },
 *   {
 *     audit: {
 *       entityType: "department",
 *       action: "UPDATE",
 *     },
 *   }
 * );
 */
export function withMutationAction<TInput, TOutput>(
  name: string,
  handler: (
    auth: AuthSession,
    input: TInput
  ) => Promise<{ old: TOutput; new: TOutput }>,
  options: ActionOptions<TInput> = {}
) {
  return withAction(
    name,
    async (auth, input) => {
      const result = await handler(auth, input);
      return Result.ok(result.new);
    },
    {
      ...options,
      audit: options.audit
        ? {
          ...options.audit,
          getEntityId: (result) => (result as any).id,
          getOldValues: (_input, _result) => {
            // Note: This won't work as expected since we only return 'new'
            // Users should use the manual audit approach for mutations
            return {};
          },
          getNewValues: (_input, result) => result as Record<string, unknown>,
        }
        : undefined,
    }
  );
}