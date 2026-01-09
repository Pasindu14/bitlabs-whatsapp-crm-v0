import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { fileUploadsTable } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/media/[key]
 *
 * Serves uploaded media files with proper CORS headers for WhatsApp API access
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { key: string } }
): Promise<NextResponse> {
  try {
    const { key } = params;

    // Fetch file record from database
    const [fileRecord] = await db
      .select({
        fileUrl: fileUploadsTable.fileUrl,
        fileName: fileUploadsTable.fileName,
        fileType: fileUploadsTable.fileType,
      })
      .from(fileUploadsTable)
      .where(eq(fileUploadsTable.fileKey, key))
      .limit(1);

    if (!fileRecord) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Fetch the file from UploadThing
    const response = await fetch(fileRecord.fileUrl);
    
    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch file" },
        { status: response.status }
      );
    }

    const fileBuffer = await response.arrayBuffer();

    // Return the file with CORS headers
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": fileRecord.fileType,
        "Content-Disposition": `inline; filename="${fileRecord.fileName}"`,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "*",
      },
    });
  } catch (error) {
    console.error("[Media Proxy Error]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
