"use client";

import { useMemo, useState } from "react";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { ConversationList } from "./conversation-list";
import { ChatThread } from "./chat-thread";
import { MessageComposer } from "./message-composer";
import { ContactSidebar } from "./contact-sidebar";
import type { ConversationResponse } from "../schemas/conversation.schema";

interface ConversationWorkspaceProps {
  companyId: number | null;
}

export function ConversationWorkspace({ companyId }: ConversationWorkspaceProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<ConversationResponse | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "archived" | undefined>(undefined);

  const [modalOpen, setModalOpen] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [newText, setNewText] = useState("");
  const [sending, setSending] = useState(false);

  const filters = useMemo(
    () => ({ status: statusFilter, assignedTo: undefined, whatsappAccountId: undefined }),
    [statusFilter]
  );

  const handleSendNew = async () => {
    if (!companyId) {
      toast.error("Missing company context");
      return;
    }
    if (!newPhone.trim() || !newText.trim()) {
      toast.error("Phone and message are required");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          recipientPhoneNumber: newPhone.trim(),
          text: newText.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Send failed");
      }
      toast.success("Message sent");
      setModalOpen(false);
      setNewPhone("");
      setNewText("");
    } catch (err: any) {
      toast.error(err?.message || "Send failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-80px)] w-full overflow-hidden rounded-xl border bg-background">
      <div className="w-[320px] shrink-0">
        <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50">
          <span className="text-sm font-semibold text-[#25D366]">WhatsApp</span>
          <div className="flex items-center gap-2">
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
              <DialogTrigger asChild>
                <Button size="icon" variant="outline">
                  +
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New chat</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <Input
                    placeholder="Phone number (E.164)"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    disabled={sending}
                  />
                  <Textarea
                    placeholder="Message"
                    value={newText}
                    onChange={(e) => setNewText(e.target.value)}
                    rows={4}
                    disabled={sending}
                  />
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setModalOpen(false)} disabled={sending}>
                    Cancel
                  </Button>
                  <Button onClick={handleSendNew} disabled={sending}>
                    {sending ? <Spinner className="h-4 w-4" /> : "Send"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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
