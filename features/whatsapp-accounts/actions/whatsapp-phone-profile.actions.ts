"use server";

import { withAction } from "@/lib/server-action-helper";
import { Result } from "@/lib/result";
import { WhatsappPhoneProfileService } from "../services/whatsapp-phone-profile.service";
import {
  whatsappPhoneProfileQuerySchema,
  type WhatsappPhoneProfileResponse,
} from "../schemas/whatsapp-phone-profile.schema";
import { z } from "zod";

type GetProfileInput = z.infer<typeof whatsappPhoneProfileQuerySchema>;

export const getWhatsappPhoneProfileAction = withAction<GetProfileInput, WhatsappPhoneProfileResponse>(
  "whatsappPhoneProfile.get",
  async (auth, input) => {
    const result = await WhatsappPhoneProfileService.getProfile(input);

    if (!result.success) {
      return Result.fail(result.message, result.error);
    }

    return result;
  },
  { schema: whatsappPhoneProfileQuerySchema }
);
