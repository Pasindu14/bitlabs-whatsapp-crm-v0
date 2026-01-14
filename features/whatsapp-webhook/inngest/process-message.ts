import { inngest } from "@/lib/inngest";
import { WebhookIngestService } from "../services/webhook-ingest.service";

export const processWebhookEvent = inngest.createFunction(
  { id: "process-whatsapp-webhook-event" },
  { event: "whatsapp/webhook.received" },
  async ({ event, step }) => {
    const { logId } = event.data;

    await step.run("process-event", async () => {
      const result = await WebhookIngestService.processEvent(logId);
      if (!result.success) {
        throw new Error(result.message || "Failed to process webhook event");
      }
    });
  }
);
