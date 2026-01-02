"use client";

import { useMemo, useState } from "react";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConversationList } from "./conversation-list";
import { ChatThread } from "./chat-thread";
import { MessageComposer } from "./message-composer";
import { ContactSidebar } from "./contact-sidebar";
import type { ConversationResponse } from "../schemas/conversation.schema";

const MOCK_USERS = [
  { id: 1, name: "Alice" },
  { id: 2, name: "Bob" },
  { id: 3, name: "Charlie" },
];

export function ConversationWorkspace() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<ConversationResponse | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "archived" | undefined>(undefined);

  const filters = useMemo(
    () => ({ status: statusFilter, assignedTo: undefined, whatsappAccountId: undefined }),
    [statusFilter]
  );

  return (
    <div className="flex h-[calc(100vh-80px)] w-full overflow-hidden rounded-xl border bg-background">
      <div className="w-[320px] shrink-0">
        <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50">
          <span className="text-sm font-medium">Conversations</span>
          <Select
            value={statusFilter ?? "all"}
            onValueChange={(val) => setStatusFilter(val === "all" ? undefined : (val as any))}
          >
            <SelectTrigger className="h-8 w-28 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <ConversationList
          selectedId={selectedId}
          onSelect={(id) => setSelectedId(id)}
          onSelectConversation={(c) => setSelectedConversation(c)}
          search={search}
          onSearchChange={setSearch}
          filters={filters}
        />
      </div>

      <Separator orientation="vertical" className="h-full" />

      <div className="flex flex-1 flex-col min-w-0">
        <div className="flex-1 min-h-0">
          <ChatThread conversationId={selectedId} />
        </div>
        <MessageComposer conversationId={selectedId} />
      </div>

      <Separator orientation="vertical" className="h-full" />

      <div className="w-[320px] shrink-0">
        <ContactSidebar conversation={selectedConversation} />
      </div>
    </div>
  );
}
