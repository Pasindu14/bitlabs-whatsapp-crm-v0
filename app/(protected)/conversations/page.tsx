import { auth } from "@/auth";
import { ConversationWorkspace } from "@/features/conversations/components/conversation-workspace";

export default async function ConversationsPage() {
  const session = await auth();
  const companyId = session?.user?.companyId ?? null;
  return <ConversationWorkspace companyId={companyId} />;
}
