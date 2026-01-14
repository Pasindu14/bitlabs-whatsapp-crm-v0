import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { processWebhookEvent } from "@/features/whatsapp-webhook/inngest/process-message";
import { helloWorld } from "@/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    processWebhookEvent,
    helloWorld,
  ],
});
