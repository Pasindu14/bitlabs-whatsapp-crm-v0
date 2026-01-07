import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { messagesTable } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/auth";
import axios from "axios";

const WHATSAPP_GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v22.0";
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.companyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { mediaId } = await params;

    if (!mediaId) {
      return NextResponse.json({ error: "Media ID is required" }, { status: 400 });
    }

    // Verify mediaId belongs to a message in the user's company
    const [message] = await db
      .select({
        id: messagesTable.id,
        mediaId: messagesTable.mediaId,
        mediaMimeType: messagesTable.mediaMimeType,
      })
      .from(messagesTable)
      .where(
        and(
          eq(messagesTable.mediaId, mediaId),
          eq(messagesTable.companyId, session.user.companyId),
          eq(messagesTable.isActive, true)
        )
      )
      .limit(1);

    if (!message) {
      return NextResponse.json({ error: "Media not found" }, { status: 404 });
    }

    if (!WHATSAPP_ACCESS_TOKEN) {
      console.error("WHATSAPP_ACCESS_TOKEN is not configured");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Step 1: Get media URL from WhatsApp Graph API
    const mediaInfoUrl = `https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}/${mediaId}`;
    const mediaInfoResponse = await axios.get(mediaInfoUrl, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      },
    });

    const mediaInfo = mediaInfoResponse.data;

    if (!mediaInfo.url) {
      console.error("Media info response missing URL:", mediaInfo);
      return NextResponse.json(
        { error: "Invalid media response from WhatsApp" },
        { status: 502 }
      );
    }

    // Step 2: Fetch the actual media file
    const mediaResponse = await axios.get(mediaInfo.url, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      },
      responseType: 'arraybuffer',
    });

    // Step 3: Stream the media back to the client
    const contentType =
      mediaResponse.headers["content-type"] ||
      message.mediaMimeType ||
      "application/octet-stream";

    return new NextResponse(Buffer.from(mediaResponse.data), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (error) {
    console.error("Error fetching media:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
