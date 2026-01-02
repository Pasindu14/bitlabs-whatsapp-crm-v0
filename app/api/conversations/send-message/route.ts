import axios from "axios";
import { NextRequest, NextResponse } from "next/server";
import type { SendTextMessageRequest, SendTextMessageResponse } from "../types";

/**
 * POST /api/whatsapp/send
 *
 * Sends a text message via WhatsApp Cloud API
 *
 * Expected request body:
 * {
 *   companyId: number;
 *   recipientPhoneNumber: string;
 *   text: string;
 *   phoneNumberId: string;
 *   accessToken: string;
 * }
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<SendTextMessageResponse>> {
  try {
    // Parse request body
    let body: SendTextMessageRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    // Validate required fields
    const { companyId, recipientPhoneNumber, text, phoneNumberId, accessToken } = body as SendTextMessageRequest & { phoneNumberId?: string; accessToken?: string };

    if (!companyId || typeof companyId !== "number") {
      return NextResponse.json(
        { success: false, error: "Missing or invalid companyId" },
        { status: 400 }
      );
    }

    if (!recipientPhoneNumber || typeof recipientPhoneNumber !== "string") {
      return NextResponse.json(
        { success: false, error: "Missing or invalid recipientPhoneNumber" },
        { status: 400 }
      );
    }

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Missing or invalid text" },
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

    // Prepare WhatsApp API request
    const apiUrl = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipientPhoneNumber.replace("+", ""),
      type: "text",
      text: { body: text },
    };

    const maxRetries = 3;
    const retryDelayMs = 1000;
    let lastError: Error | null = null;

    // Retry logic
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const { data } = await axios.post(apiUrl, payload, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        });

        console.log("[WhatsApp Send Text API Request]", {
          url: apiUrl,
          to: recipientPhoneNumber.slice(-4),
          attempt: attempt + 1,
        });

        const messageId = data?.messages?.[0]?.id || "unknown";
        console.log("[WhatsApp Send Text API Success]", {
          messageId,
          recipientPhoneNumber: recipientPhoneNumber.slice(-4),
          attempt: attempt + 1,
        });

        return NextResponse.json({
          success: true,
          messageId,
        });
      } catch (error) {
        const axiosError = error as { response?: { status?: number; data?: unknown }; message?: string };
        const status = axiosError?.response?.status ?? 500;
        const responseData = axiosError?.response?.data as { error?: { message?: string } };
        const payloadErr: string =
          responseData?.error?.message ??
          (typeof axiosError?.response?.data === "string" ? (axiosError.response.data as string) : "") ??
          axiosError?.message ??
          "Internal error";

        console.error("[WhatsApp Send Text API Error]", {
          status,
          error: payloadErr,
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
    console.error("[WhatsApp Send Text API] All retries failed", {
      error: lastError?.message,
    });

    return NextResponse.json(
      { success: false, error: `Failed to send message: ${lastError?.message}` },
      { status: 500 }
    );
  } catch (error) {
    const unexpectedError = error as { message?: string };
    console.error("[WhatsApp Send Text API] Unexpected error", {
      error: unexpectedError?.message,
    });

    return NextResponse.json(
      { success: false, error: "Unexpected server error" },
      { status: 500 }
    );
  }
}
