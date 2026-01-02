"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ArchiveToggle } from "./archive-toggle";
import { AssignDropdown } from "./assign-dropdown";
import type { ConversationResponse } from "../schemas/conversation.schema";
import { useUsers } from "@/features/users/hooks/use-users";

interface Props {
  conversation: ConversationResponse | null;
}

export function ContactSidebar({ conversation }: Props) {
  const { data: usersData, isLoading: usersLoading } = useUsers({
    cursor: undefined,
    limit: 50,
  } as any);

  const users =
    usersData?.pages.flatMap((p: any) => p.items?.map((u: any) => ({ id: u.id, name: u.name })) ?? []) ?? [];

  if (!conversation) {
    return (
      <div className="p-4 text-sm text-muted-foreground border-l h-full">Select a conversation</div>
    );
  }

  return (
    <div className="h-full border-l bg-muted/30">
      <Card className="m-4">
        <CardHeader>
          <CardTitle className="text-base">Contact</CardTitle>
          <div className="text-sm text-muted-foreground break-all">{conversation.phoneNumber}</div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <Badge variant={conversation.status === "archived" ? "secondary" : "default"}>
              {conversation.status}
            </Badge>
            <Badge variant="outline">Unread: {conversation.unreadCount}</Badge>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Assigned to:</span>
            {usersLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <AssignDropdown
                conversationId={conversation.id}
                assignedTo={conversation.assignedTo ?? null}
                users={users}
              />
            )}
          </div>

          <ArchiveToggle conversationId={conversation.id} isArchived={conversation.status === "archived"} />

          <Separator />
          <div className="space-y-1 text-muted-foreground">
            <div>WhatsApp Account ID: {conversation.whatsappAccountId ?? "-"}</div>
            <div>Contact ID: {conversation.contactId ?? "-"}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
