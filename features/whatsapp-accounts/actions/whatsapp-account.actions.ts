"use server";

import { withAction } from "@/lib/server-action-helper";
import { Result } from "@/lib/result";
import { WhatsappAccountService } from "../services/whatsapp-account.service";
import {
  whatsappAccountCreateClientSchema,
  whatsappAccountListClientSchema,
  whatsappAccountUpdateClientSchema,
  whatsappAccountGetSchema,
  whatsappAccountIdSchema,
  type WhatsappAccountListResponse,
  type WhatsappAccountResponse,
} from "../schemas/whatsapp-account.schema";
import { z } from "zod";

type IdOnly = z.infer<typeof whatsappAccountIdSchema>;
type ListInput = z.infer<typeof whatsappAccountListClientSchema>;
type GetInput = z.infer<typeof whatsappAccountGetSchema>;
type CreateInput = z.infer<typeof whatsappAccountCreateClientSchema>;
type UpdateInput = z.infer<typeof whatsappAccountUpdateClientSchema> & { id: number };

export const listWhatsappAccountsAction = withAction<ListInput, WhatsappAccountListResponse>(
  "whatsappAccounts.list",
  async (auth, input) => {
    const result = await WhatsappAccountService.list({
      ...(input as ListInput),
      companyId: auth.companyId,
    });

    if (!result.success) {
      return Result.fail(result.message, result.error);
    }

    return result;
  },
  { schema: whatsappAccountListClientSchema }
);

export const getWhatsappAccountAction = withAction<GetInput, WhatsappAccountResponse>(
  "whatsappAccounts.get",
  async (auth, input) => {
    const result = await WhatsappAccountService.get({
      ...input,
      companyId: auth.companyId,
    });

    if (!result.success) {
      return Result.fail(result.message, result.error);
    }

    return result;
  },
  { schema: whatsappAccountGetSchema }
);

export const createWhatsappAccountAction = withAction<CreateInput, WhatsappAccountResponse>(
  "whatsappAccounts.create",
  async (auth, input) => {
    const result = await WhatsappAccountService.create({
      ...input,
      companyId: auth.companyId,
      userId: auth.userId,
    });

    if (!result.success) {
      return Result.fail(result.message, result.error);
    }

    return result;
  },
  { schema: whatsappAccountCreateClientSchema }
);

export const updateWhatsappAccountAction = withAction<UpdateInput, WhatsappAccountResponse>(
  "whatsappAccounts.update",
  async (auth, input) => {
    const result = await WhatsappAccountService.update({
      ...input,
      companyId: auth.companyId,
      userId: auth.userId,
    });

    if (!result.success) {
      return Result.fail(result.message, result.error);
    }

    return result;
  },
  {
    schema: whatsappAccountUpdateClientSchema.extend({
      id: z.number().int(),
    }),
  }
);

export const setDefaultWhatsappAccountAction = withAction<IdOnly, null>(
  "whatsappAccounts.setDefault",
  async (auth, input) => {
    const result = await WhatsappAccountService.setDefault({
      id: input.id,
      companyId: auth.companyId,
      userId: auth.userId,
    });

    if (!result.success) {
      return Result.fail(result.message, result.error);
    }

    return result;
  },
  { schema: whatsappAccountIdSchema }
);

export const deactivateWhatsappAccountAction = withAction<IdOnly, null>(
  "whatsappAccounts.deactivate",
  async (auth, input) => {
    const result = await WhatsappAccountService.deactivate({
      id: input.id,
      companyId: auth.companyId,
      userId: auth.userId,
    });

    if (!result.success) {
      return Result.fail(result.message, result.error);
    }

    return result;
  },
  { schema: whatsappAccountIdSchema }
);

export const activateWhatsappAccountAction = withAction<IdOnly, null>(
  "whatsappAccounts.activate",
  async (auth, input) => {
    const result = await WhatsappAccountService.activate({
      id: input.id,
      companyId: auth.companyId,
      userId: auth.userId,
    });

    if (!result.success) {
      return Result.fail(result.message, result.error);
    }

    return result;
  },
  { schema: whatsappAccountIdSchema }
);
