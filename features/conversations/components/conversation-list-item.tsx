"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ConversationResponse } from "../schemas/conversation.schema";

type Props = {
  conversation: ConversationResponse;
  selected: boolean;
  onSelect: (id: number) => void;
};

export function ConversationListItem({ conversation, selected, onSelect }: Props) {
  return (
    <button
      onClick={() => onSelect(conversation.id)}
      className={cn(
        "w-full text-left px-3 py-2 rounded-lg border transition",
        selected
          ? "bg-primary/10 border-primary/50"
          : "hover:bg-muted/50 border-transparent"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium truncate">{conversation.phoneNumber}</div>
        {conversation.unreadCount > 0 ? (
          <Badge variant="secondary">{conversation.unreadCount}</Badge>
        ) : null}
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
        <span>{conversation.status === "archived" ? "Archived" : "Active"}</span>
        <span>{new Date(conversation.lastMessageAt).toLocaleString()}</span>
      </div>
    </button>
  );
}
