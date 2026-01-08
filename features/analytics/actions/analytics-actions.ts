"use server"

import { withAction } from "@/lib/server-action-helper";
import { Result } from "@/lib/result";
import type {
  AccountAnalyticsListInput,
  AccountAnalyticsListResponse,
  AccountAnalyticsGetInput,
  AccountAnalyticsDetail,
} from "../schemas/analytics-schema";
import {
  accountAnalyticsListSchema,
  accountAnalyticsGetSchema,
} from "../schemas/analytics-schema";
import { AnalyticsService } from "../services/analytics-service";

export const listAccountAnalyticsAction = withAction<AccountAnalyticsListInput, AccountAnalyticsListResponse>(
  "analytics.list",
  async (auth, input) => {
    const result = await AnalyticsService.list({
      ...input,
      companyId: auth.companyId,
    });
    if (!result.isOk) return result;

    return Result.ok(result.data, "Analytics loaded");
  },
  { schema: accountAnalyticsListSchema }
);

export const getAccountAnalyticsAction = withAction<AccountAnalyticsGetInput, AccountAnalyticsDetail>(
  "analytics.getByAccount",
  async (auth, input) => {
    const result = await AnalyticsService.getByAccount({
      ...input,
      companyId: auth.companyId,
    });
    if (!result.isOk) return result;

    return Result.ok(result.data, "Account analytics loaded");
  },
  { schema: accountAnalyticsGetSchema }
);
