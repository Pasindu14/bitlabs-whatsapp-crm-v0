import { db } from "@/db/drizzle";
import { auditLogsTable } from "@/db/schema";
import { Result } from "@/lib/result";
import { createPerformanceLogger } from "@/lib/logger";

export interface AuditLogData {
  companyId: number;
  userId: number;
  action: string;
  resourceId: number;
  entityType?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  changeReason?: string;
}

export class AuditLogService {
  static async log(data: AuditLogData): Promise<Result<null>> {
    const logger = createPerformanceLogger("AuditLogService.log");

    try {
      await db.insert(auditLogsTable).values({
        companyId: data.companyId,
        changedBy: data.userId,
        action: data.action,
        entityType: data.entityType || "unknown",
        entityId: data.resourceId,
        oldValues: data.oldValues || null,
        newValues: data.newValues || null,
        changeReason: data.changeReason || null,
      });

      logger.complete(1);
      return Result.ok(null);
    } catch (error) {
      logger.fail(error as Error);
      console.error("Audit logging failed:", error);
      return Result.ok(null);
    }
  }

  static async logFailure(params: {
    entityType: string;
    entityId: number | null;
    companyId: number;
    userId: number;
    action: string;
    error: string;
  }): Promise<void> {
    try {
      await db.insert(auditLogsTable).values({
        entityType: params.entityType,
        entityId: params.entityId ?? 0,
        companyId: params.companyId,
        action: `${params.action}_FAILED`,
        oldValues: null,
        newValues: { error: params.error },
        changedBy: params.userId,
        changeReason: "Operation failed",
      });
    } catch (auditError) {
      console.error("Failed to log audit failure:", auditError);
    }
  }
}