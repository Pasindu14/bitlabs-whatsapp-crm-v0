import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { whatsappWebhookConfigsTable, whatsappAccountsTable } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { WebhookIngestService } from "@/features/whatsapp-webhook/services/webhook-ingest.service";
import { parseISO } from "date-fns";

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

    if (mode === "subscribe" && VERIFY_TOKEN && token === VERIFY_TOKEN) {
      console.log("WEBHOOK VERIFIED");
      return new NextResponse(challenge ?? "", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 403 });
  } catch (error) {
    console.error("Webhook GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get("x-hub-signature-256");
    const rawBody = await request.text();

    if (!rawBody) {
      return NextResponse.json({ error: "Empty body" }, { status: 400 });
    }

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!payload.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id) {
      return NextResponse.json({ error: "Missing phone_number_id in payload" }, { status: 400 });
    }

    const phoneNumberId = payload.entry[0].changes[0].value.metadata.phone_number_id;

    const [account] = await db
      .select({
        id: whatsappAccountsTable.id,
        companyId: whatsappAccountsTable.companyId,
        isActive: whatsappAccountsTable.isActive,
      })
      .from(whatsappAccountsTable)
      .where(eq(whatsappAccountsTable.phoneNumberId, phoneNumberId))
      .limit(1);

    if (!account) {
      return NextResponse.json({ error: "WhatsApp account not found" }, { status: 404 });
    }

    if (!account.isActive) {
      return NextResponse.json({ error: "WhatsApp account is inactive" }, { status: 403 });
    }

    const [config] = await db
      .select({
        id: whatsappWebhookConfigsTable.id,
        companyId: whatsappWebhookConfigsTable.companyId,
        whatsappAccountId: whatsappWebhookConfigsTable.whatsappAccountId,
        appSecret: whatsappWebhookConfigsTable.appSecret,
        isActive: whatsappWebhookConfigsTable.isActive,
      })
      .from(whatsappWebhookConfigsTable)
      .where(
        and(
          eq(whatsappWebhookConfigsTable.companyId, account.companyId),
          eq(whatsappWebhookConfigsTable.whatsappAccountId, account.id)
        )
      )
      .limit(1);

    if (!config) {
      return NextResponse.json({ error: "Webhook config not found" }, { status: 404 });
    }

    if (!config.isActive) {
      return NextResponse.json({ error: "Webhook is inactive" }, { status: 403 });
    }

    const whatsappTimestamp = payload.entry[0].changes[0].value?.messages?.[0]?.timestamp;
    const eventTs = whatsappTimestamp ? new Date(parseInt(whatsappTimestamp, 10) * 1000) : new Date();

    const logResult = await WebhookIngestService.logEvent(
      config.companyId,
      config.whatsappAccountId,
      payload,
      signature,
      eventTs
    );

    console.log("LOG RESULT", logResult);
    
    if (!logResult.success) {
      console.error("Failed to log webhook event:", logResult.message);
      return NextResponse.json({ error: "Failed to process event" }, { status: 500 });
    }

    if (logResult.data?.logId && logResult.data.logId > 0) {
      WebhookIngestService.processEvent(logResult.data.logId).catch((error) => {
        console.error("Failed to process webhook event:", error);
      });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Webhook POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
