import axios from "axios";
import { NextRequest, NextResponse } from "next/server";
import type { GetMessageHistoryRequest, GetMessageHistoryResponse } from "../types";

/**
 * GET /api/conversations/get-message-history
 *
 * Fetches message history via WhatsApp Cloud API
 *
 * Expected query parameters:
 *   companyId: number
 *   phoneNumberId: string
 *   accessToken: string
 *   limit?: number
 *   before?: string
 *   after?: string
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<GetMessageHistoryResponse>> {
  try {
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const companyId = searchParams.get("companyId");
    const phoneNumberId = searchParams.get("phoneNumberId");
    const accessToken = searchParams.get("accessToken");
    const limit = searchParams.get("limit");
    const before = searchParams.get("before");
    const after = searchParams.get("after");

    // Validate required fields
    if (!companyId || isNaN(Number(companyId))) {
      return NextResponse.json(
        { success: false, error: "Missing or invalid companyId" },
        { status: 400 }
      );
    }

    if (!phoneNumberId || typeof phoneNumberId !== "string") {
      return NextResponse.json(
        { success: false, error: "Missing or invalid phoneNumberId" },
        { status: 400 }
      );
    }

    if (!accessToken || typeof accessToken !== "string") {
      return NextResponse.json(
        { success: false, error: "Missing or invalid accessToken" },
        { status: 400 }
      );
    }

    // Get API version from environment (constant)
    const apiVersion = process.env.WHATSAPP_API_VERSION || "v18.0";

    if (!apiVersion) {
      console.error("[WhatsApp API] Missing WHATSAPP_API_VERSION environment variable");
      return NextResponse.json(
        { success: false, error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Build query string for WhatsApp API
    const queryParams = new URLSearchParams();
    queryParams.append("fields", "messages{from,to,direction,timestamp,type},paging");
    if (limit) queryParams.append("limit", limit);
    if (before) queryParams.append("before", before);
    if (after) queryParams.append("after", after);

    const queryString = queryParams.toString();
    const apiUrl = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/message_history`;

    const maxRetries = 3;
    const retryDelayMs = 1000;
    let lastError: Error | null = null;

    // Retry logic
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const { data } = await axios.get(apiUrl, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        });

        console.log("[WhatsApp Message History API Request]", {
          url: apiUrl,
          attempt: attempt + 1,
        });

        const messages = data?.messages?.data || [];
        console.log("[WhatsApp Message History API Success]", {
          messageCount: messages.length,
          attempt: attempt + 1,
        });

        return NextResponse.json({
          success: true,
          messages: data,
        });
      } catch (error) {
        const axiosError = error as { response?: { status?: number; data?: unknown }; message?: string };
        const status = axiosError?.response?.status ?? 500;
        const responseData = axiosError?.response?.data as { error?: { message?: string; type?: string; code?: number } };
        const payloadErr: string =
          responseData?.error?.message ??
          (typeof axiosError?.response?.data === "string" ? (axiosError.response.data as string) : "") ??
          axiosError?.message ??
          "Internal error";

        console.error("[WhatsApp Message History API Error]", {
          status,
          error: payloadErr,
          errorType: responseData?.error?.type,
          errorCode: responseData?.error?.code,
          fullResponse: axiosError?.response?.data,
          attempt: attempt + 1,
        });

        // Don't retry on 4xx
        if (status >= 400 && status < 500) {
          return NextResponse.json(
            { success: false, error: payloadErr },
            { status }
          );
        }

        lastError = new Error(payloadErr);
        if (attempt < maxRetries - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, retryDelayMs * (attempt + 1))
          );
        }
      }
    }

    // All retries failed
    console.error("[WhatsApp Message History API] All retries failed", {
      error: lastError?.message,
    });

    return NextResponse.json(
      { success: false, error: `Failed to fetch message history: ${lastError?.message}` },
      { status: 500 }
    );
  } catch (error) {
    const unexpectedError = error as { message?: string };
    console.error("[WhatsApp Message History API] Unexpected error", {
      error: unexpectedError?.message,
    });

    return NextResponse.json(
      { success: false, error: "Unexpected server error" },
      { status: 500 }
    );
  }
}
