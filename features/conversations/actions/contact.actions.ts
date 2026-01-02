"use server";

import { withAction } from "@/lib/server-action-helper";
import { Result } from "@/lib/result";
import { ContactService } from "../services/contact.service";
import {
  contactCreateClientSchema,
  contactListClientSchema,
  contactUpdateClientSchema,
  type ContactListInput,
  type ContactListResponse,
  type ContactResponse,
  type ContactCreateInput,
  type ContactUpdateInput,
} from "../schemas/contact.schema";
import { z } from "zod";

export const listContactsAction = withAction<ContactListInput, ContactListResponse>(
  "contacts.list",
  async (auth, input) => {
    const result = await ContactService.list({ ...input, companyId: auth.companyId });
    if (!result.success) return Result.fail(result.message, result.error);
    return result;
  },
  { schema: contactListClientSchema }
);

export const upsertContactAction = withAction<
  (ContactCreateInput | (ContactUpdateInput & { id: number })),
  ContactResponse
>(
  "contacts.upsert",
  async (auth, input) => {
    const result = await ContactService.upsert({
      ...(input as any),
      companyId: auth.companyId,
      userId: auth.userId,
    });
    if (!result.success) return Result.fail(result.message, result.error);
    return result;
  },
  {
    schema: z.union([
      contactCreateClientSchema,
      contactUpdateClientSchema.extend({ id: z.number().int() }),
    ]),
  }
);
