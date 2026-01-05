import { NextRequest, NextResponse } from "next/server";

const VERIFY_TOKEN = process.env.VERIFY_TOKEN; // same name as your Express example

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  const mode = sp.get("hub.mode");
  const token = sp.get("hub.verify_token");
  const challenge = sp.get("hub.challenge");

  if (mode === "subscribe" && VERIFY_TOKEN && token === VERIFY_TOKEN) {
    console.log("WEBHOOK VERIFIED");
    return new NextResponse(challenge ?? "", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return new NextResponse("", { status: 403 });
}

export async function POST(req: NextRequest) {
  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);

  let payload: unknown = null;
  try {
    payload = await req.json();
  } catch {
    return new NextResponse("", { status: 400 });
  }

  console.log(`\n\nWebhook received ${timestamp}\n`);
  console.log(JSON.stringify(payload, null, 2));

  return new NextResponse("", { status: 200 });
}
