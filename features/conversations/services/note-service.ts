import { Result } from "@/lib/result";
import { createPerformanceLogger } from "@/lib/logger";
import { db } from "@/db/drizzle";
import { conversationNotesTable, conversationsTable } from "@/db/schema";
import { eq, and, desc, lt } from "drizzle-orm";
import { AuditLogService } from "@/lib/audit-log.service";
import type {
  ConversationNoteCreateServerInput,
  ConversationNoteUpdateServerInput,
  ConversationNoteDeleteInput,
  ConversationNoteListInput,
  ConversationNoteGetInput,
  ConversationNoteResponse,
  ConversationNoteListResponse,
} from "../schemas/note-schema";

export class NoteService {
  static async create(
    data: ConversationNoteCreateServerInput
  ): Promise<Result<ConversationNoteResponse>> {
    const logger = createPerformanceLogger("NoteService.create");

    try {
      const conversation = await db.query.conversationsTable.findFirst({
        where: and(
          eq(conversationsTable.id, data.conversationId),
          eq(conversationsTable.companyId, data.companyId),
          eq(conversationsTable.isActive, true)
        ),
      });

      if (!conversation) {
        logger.fail("Conversation not found");
        return Result.fail("Conversation not found", { code: "NOT_FOUND" });
      }

      const [note] = await db
        .insert(conversationNotesTable)
        .values({
          conversationId: data.conversationId,
          companyId: data.companyId,
          createdBy: data.userId,
          content: data.content,
          isPinned: data.isPinned,
        })
        .returning();

      const noteWithCreator = await db.query.conversationNotesTable.findFirst({
        where: eq(conversationNotesTable.id, note.id),
        with: {
          creator: {
            columns: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      logger.complete(1, { conversationId: data.conversationId, noteId: note.id });

      return Result.ok(noteWithCreator as ConversationNoteResponse, "Note created successfully");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Operation failed";
      logger.fail(error as Error);
      await AuditLogService.logFailure({
        entityType: "conversation_note",
        entityId: null,
        companyId: data.companyId,
        userId: data.userId,
        action: "CREATE",
        error: errorMessage,
      });
      return Result.fail("Failed to create note", { code: "INTERNAL_ERROR" });
    }
  }

  static async update(
    data: ConversationNoteUpdateServerInput
  ): Promise<Result<ConversationNoteResponse>> {
    const logger = createPerformanceLogger("NoteService.update");

    try {
      const existingNote = await db.query.conversationNotesTable.findFirst({
        where: and(
          eq(conversationNotesTable.id, data.noteId),
          eq(conversationNotesTable.companyId, data.companyId),
          eq(conversationNotesTable.isActive, true)
        ),
      });

      if (!existingNote) {
        logger.fail("Note not found");
        return Result.fail("Note not found", { code: "NOT_FOUND" });
      }

      if (existingNote.createdBy !== data.userId) {
        logger.fail("Unauthorized");
        return Result.fail("Unauthorized: You can only edit your own notes", { code: "UNAUTHORIZED" });
      }

      const [updatedNote] = await db
        .update(conversationNotesTable)
        .set({
          content: data.content,
          isPinned: data.isPinned !== undefined ? data.isPinned : existingNote.isPinned,
          updatedBy: data.userId,
          updatedAt: new Date(),
        })
        .where(eq(conversationNotesTable.id, data.noteId))
        .returning();

      await AuditLogService.log({
        companyId: data.companyId,
        userId: data.userId,
        action: 'UPDATE',
        resourceId: data.noteId,
        entityType: 'conversation_note',
        newValues: { content: data.content, isPinned: data.isPinned },
      });

      const noteWithCreator = await db.query.conversationNotesTable.findFirst({
        where: eq(conversationNotesTable.id, updatedNote.id),
        with: {
          creator: {
            columns: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      logger.complete(1, { noteId: data.noteId });

      return Result.ok(noteWithCreator as ConversationNoteResponse, "Note updated successfully");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Operation failed";
      logger.fail(error as Error);
      await AuditLogService.logFailure({
        entityType: "conversation_note",
        entityId: data.noteId,
        companyId: data.companyId,
        userId: data.userId,
        action: "UPDATE",
        error: errorMessage,
      });
      return Result.fail("Failed to update note", { code: "INTERNAL_ERROR" });
    }
  }

  static async delete(
    data: ConversationNoteDeleteInput
  ): Promise<Result<{ success: boolean }>> {
    const logger = createPerformanceLogger("NoteService.delete");

    try {
      const existingNote = await db.query.conversationNotesTable.findFirst({
        where: and(
          eq(conversationNotesTable.id, data.noteId),
          eq(conversationNotesTable.companyId, data.companyId),
          eq(conversationNotesTable.isActive, true)
        ),
      });

      if (!existingNote) {
        logger.fail("Note not found");
        return Result.fail("Note not found", { code: "NOT_FOUND" });
      }

      if (existingNote.createdBy !== data.userId) {
        logger.fail("Unauthorized");
        return Result.fail("Unauthorized: You can only delete your own notes", { code: "UNAUTHORIZED" });
      }

      await db
        .update(conversationNotesTable)
        .set({ isActive: false })
        .where(eq(conversationNotesTable.id, data.noteId));

      await AuditLogService.log({
        companyId: data.companyId,
        userId: data.userId,
        action: 'DELETE',
        resourceId: data.noteId,
        entityType: 'conversation_note',
        newValues: { isActive: false },
      });

      logger.complete(1, { noteId: data.noteId });

      return Result.ok({ success: true }, "Note deleted successfully");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Operation failed";
      logger.fail(error as Error);
      await AuditLogService.logFailure({
        entityType: "conversation_note",
        entityId: data.noteId,
        companyId: data.companyId,
        userId: data.userId,
        action: "DELETE",
        error: errorMessage,
      });
      return Result.fail("Failed to delete note", { code: "INTERNAL_ERROR" });
    }
  }

  static async listForConversation(
    data: ConversationNoteListInput & { companyId: number }
  ): Promise<Result<ConversationNoteListResponse>> {
    const logger = createPerformanceLogger("NoteService.listForConversation");

    try {
      const fetchLimit = data.limit + 1;
      let cursorCondition = undefined;

      if (data.cursor) {
        const cursor = JSON.parse(Buffer.from(data.cursor, 'base64').toString());
        cursorCondition = and(
          lt(conversationNotesTable.createdAt, cursor.createdAt),
          eq(conversationNotesTable.id, cursor.id)
        );
      }

      const companyFilter = and(
        eq(conversationNotesTable.conversationId, data.conversationId),
        eq(conversationNotesTable.companyId, data.companyId),
        eq(conversationNotesTable.isActive, true)
      );

      const whereClause = cursorCondition ? and(companyFilter, cursorCondition) : companyFilter;

      const notes = await db.query.conversationNotesTable.findMany({
        where: whereClause,
        with: {
          creator: {
            columns: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: [
          desc(conversationNotesTable.isPinned),
          desc(conversationNotesTable.createdAt),
          desc(conversationNotesTable.id),
        ],
        limit: fetchLimit,
      });

      const hasMore = notes.length > data.limit;
      const paginatedNotes = hasMore ? notes.slice(0, data.limit) : notes;

      let nextCursor = undefined;
      if (hasMore && paginatedNotes.length > 0) {
        const lastNote = paginatedNotes[paginatedNotes.length - 1];
        nextCursor = Buffer.from(
          JSON.stringify({ createdAt: lastNote.createdAt, id: lastNote.id })
        ).toString('base64');
      }

      logger.complete(paginatedNotes.length, { conversationId: data.conversationId });

      return Result.ok({
        notes: paginatedNotes as ConversationNoteResponse[],
        nextCursor,
        hasMore,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Operation failed";
      logger.fail(error as Error);
      await AuditLogService.logFailure({
        entityType: "conversation_note",
        entityId: null,
        companyId: data.companyId,
        userId: 0,
        action: "READ",
        error: errorMessage,
      });
      return Result.fail("Failed to list notes", { code: "INTERNAL_ERROR" });
    }
  }

  static async getById(
    data: ConversationNoteGetInput & { companyId: number }
  ): Promise<Result<ConversationNoteResponse>> {
    const logger = createPerformanceLogger("NoteService.getById");

    try {
      const note = await db.query.conversationNotesTable.findFirst({
        where: and(
          eq(conversationNotesTable.id, data.noteId),
          eq(conversationNotesTable.companyId, data.companyId),
          eq(conversationNotesTable.isActive, true)
        ),
        with: {
          creator: {
            columns: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      if (!note) {
        logger.fail("Note not found");
        return Result.fail("Note not found", { code: "NOT_FOUND" });
      }

      logger.complete(1, { noteId: data.noteId });

      return Result.ok(note as ConversationNoteResponse);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Operation failed";
      logger.fail(error as Error);
      await AuditLogService.logFailure({
        entityType: "conversation_note",
        entityId: data.noteId,
        companyId: data.companyId,
        userId: 0,
        action: "READ",
        error: errorMessage,
      });
      return Result.fail("Failed to get note", { code: "INTERNAL_ERROR" });
    }
  }

  static async getUserNoteForConversation(
    conversationId: number,
    userId: number,
    companyId: number
  ): Promise<Result<ConversationNoteResponse | null>> {
    const logger = createPerformanceLogger("NoteService.getUserNoteForConversation");

    try {
      const note = await db.query.conversationNotesTable.findFirst({
        where: and(
          eq(conversationNotesTable.conversationId, conversationId),
          eq(conversationNotesTable.createdBy, userId),
          eq(conversationNotesTable.companyId, companyId),
          eq(conversationNotesTable.isActive, true)
        ),
        with: {
          creator: {
            columns: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      logger.complete(note ? 1 : 0, { conversationId, userId });

      return Result.ok((note as ConversationNoteResponse) || null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Operation failed";
      logger.fail(error as Error);
      await AuditLogService.logFailure({
        entityType: "conversation_note",
        entityId: null,
        companyId,
        userId,
        action: "READ",
        error: errorMessage,
      });
      return Result.fail("Failed to get user note", { code: "INTERNAL_ERROR" });
    }
  }
}
