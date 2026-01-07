import { Result } from "./result";
import { createPerformanceLogger } from "./logger";
import { db } from "@/db/drizzle";
import { fileUploadsTable } from "@/db/schema";
import { eq } from "drizzle-orm";

export interface FileUploadResponse {
  fileKey: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  fileType: string;
}

export class UploadThingService {
  static async uploadImage(
    file: File,
    companyId: number,
    userId: number,
    conversationId: number
  ): Promise<Result<FileUploadResponse>> {
    const logger = createPerformanceLogger("UploadThingService.uploadImage", {
      context: {
        companyId,
        userId,
        fileSize: file.size,
        fileType: file.type,
      },
    });

    try {
      logger.checkpoint("validation_start");

      const MAX_FILE_SIZE = 4 * 1024 * 1024;
      const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

      if (file.size > MAX_FILE_SIZE) {
        return Result.badRequest(`File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`, {
          fileSize: file.size,
          maxSize: MAX_FILE_SIZE,
        });
      }

      if (!ALLOWED_TYPES.includes(file.type)) {
        return Result.badRequest(`Invalid file type. Allowed: ${ALLOWED_TYPES.join(", ")}`, {
          fileType: file.type,
          allowedTypes: ALLOWED_TYPES,
        });
      }

      logger.checkpoint("validation_complete");

      const formData = new FormData();
      formData.append("file", file);

      const uploadResponse = await fetch("https://uploadthing.com/api/uploadFiles", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.UPLOADTHING_TOKEN}`,
        },
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        logger.fail(`UploadThing API error: ${errorText}`);
        return Result.internal("Failed to upload file to UploadThing", {
          status: uploadResponse.status,
          error: errorText,
        });
      }

      const uploadData = await uploadResponse.json();
      logger.checkpoint("upload_complete");

      if (!uploadData.data || !uploadData.data[0]) {
        return Result.internal("Invalid response from UploadThing", { response: uploadData });
      }

      const uploadedFile = uploadData.data[0];
      const fileKey = uploadedFile.key;
      const fileUrl = uploadedFile.url;

      const response = await UploadThingService.saveFileUpload(
        fileKey,
        fileUrl,
        file.name,
        file.size,
        file.type,
        companyId,
        userId,
        conversationId
      );

      logger.complete();
      return response;
    } catch (error) {
      logger.fail(error instanceof Error ? error : "Unknown error");
      return Result.internal("Failed to upload image", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  static async saveFileUpload(
    fileKey: string,
    fileUrl: string,
    fileName: string,
    fileSize: number,
    fileType: string,
    companyId: number,
    userId: number,
    conversationId: number
  ): Promise<Result<FileUploadResponse>> {
    const logger = createPerformanceLogger("UploadThingService.saveFileUpload", {
      context: { companyId, userId, fileSize, fileType },
    });

    try {
      const fileRecord = await db
        .insert(fileUploadsTable)
        .values({
          companyId,
          conversationId,
          fileKey,
          fileName,
          fileUrl,
          fileSize,
          fileType,
          mimeType: fileType,
          uploadedBy: userId,
        })
        .returning();

      logger.complete();
      return Result.ok({
        fileKey,
        fileUrl,
        fileName,
        fileSize,
        fileType,
      }, "File upload saved");
    } catch (error) {
      logger.fail(error instanceof Error ? error : "Unknown error");
      return Result.internal("Failed to save file upload", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  static async deleteFile(fileKey: string, companyId: number): Promise<Result<void>> {
    const logger = createPerformanceLogger("UploadThingService.deleteFile", {
      context: { companyId, fileKey },
    });

    try {
      const fileRecord = await db
        .select()
        .from(fileUploadsTable)
        .where(eq(fileUploadsTable.fileKey, fileKey))
        .limit(1);

      if (!fileRecord.length) {
        return Result.notFound("File not found");
      }

      if (fileRecord[0].companyId !== companyId) {
        return Result.forbidden("You don't have permission to delete this file");
      }

      await db
        .delete(fileUploadsTable)
        .where(eq(fileUploadsTable.fileKey, fileKey));

      logger.complete();
      return Result.ok(undefined, "File deleted successfully");
    } catch (error) {
      logger.fail(error instanceof Error ? error : "Unknown error");
      return Result.internal("Failed to delete file", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  static async getFileByKey(
    fileKey: string,
    companyId: number
  ): Promise<Result<FileUploadResponse>> {
    const logger = createPerformanceLogger("UploadThingService.getFileByKey", {
      context: { companyId, fileKey },
    });

    try {
      const fileRecord = await db
        .select()
        .from(fileUploadsTable)
        .where(eq(fileUploadsTable.fileKey, fileKey))
        .limit(1);

      if (!fileRecord.length) {
        return Result.notFound("File not found");
      }

      if (fileRecord[0].companyId !== companyId) {
        return Result.forbidden("You don't have permission to access this file");
      }

      const file = fileRecord[0];

      const response: FileUploadResponse = {
        fileKey: file.fileKey,
        fileUrl: file.fileUrl,
        fileName: file.fileName,
        fileSize: file.fileSize,
        fileType: file.fileType,
      };

      logger.complete();
      return Result.ok(response);
    } catch (error) {
      logger.fail(error instanceof Error ? error : "Unknown error");
      return Result.internal("Failed to retrieve file", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
