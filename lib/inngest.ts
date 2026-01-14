import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "bitlabs-whatsapp-crm",
  eventKey: process.env.INNGEST_EVENT_KEY,
});
