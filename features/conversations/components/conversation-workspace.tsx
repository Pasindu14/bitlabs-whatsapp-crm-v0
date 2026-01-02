"use client";

import { useMemo, useState, useCallback } from "react";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { ConversationList } from "./conversation-list";
import { ChatThread } from "./chat-thread";
import { MessageComposer } from "./message-composer";
import { ContactSidebar } from "./contact-sidebar";
import { useSendMessage } from "../hooks/use-send-new-message";
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
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [textError, setTextError] = useState<string | null>(null);

  const sendMessage = useSendMessage();
  const filters = useMemo(
    () => ({ status: statusFilter, assignedTo: undefined, whatsappAccountId: undefined }),
    [statusFilter]
  );

  const validateInputs = useCallback(() => {
    let isValid = true;
    setPhoneError(null);
    setTextError(null);

    if (!newPhone.trim()) {
      setPhoneError("Phone number is required");
      isValid = false;
    } else if (newPhone.trim().length < 3) {
      setPhoneError("Phone number must be at least 3 characters");
      isValid = false;
    }

    if (!newText.trim()) {
      setTextError("Message is required");
      isValid = false;
    } else if (newText.trim().length === 0) {
      setTextError("Message cannot be empty");
      isValid = false;
    }

    return isValid;
  }, [newPhone, newText]);

  const handleSendNew = async () => {
    if (!companyId) {
      toast.error("Missing company context");
      return;
    }

    if (!validateInputs()) {
      return;
    }

    try {
      const result = await sendMessage.mutateAsync({
        phoneNumber: newPhone.trim(),
        text: newText.trim(),
      });

      setModalOpen(false);
      setNewPhone("");
      setNewText("");
      setPhoneError(null);
      setTextError(null);

      if (result?.conversationId) {
        setSelectedId(result.conversationId);
      }
    } catch (err: any) {
      const errorMessage = err?.message || "Failed to send message";
      toast.error(errorMessage);
    }
  };

  const handleModalOpenChange = (open: boolean) => {
    setModalOpen(open);
    if (!open) {
      setNewPhone("");
      setNewText("");
      setPhoneError(null);
      setTextError(null);
    }
  };

  return (
    <div className="flex h-[calc(100vh-80px)] w-full overflow-hidden rounded-xl border bg-background">
      <div className="w-[320px] shrink-0">
        <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50">
          <span className="text-sm font-semibold text-[#25D366]">WhatsApp</span>
          <div className="flex items-center gap-2">
            <Dialog open={modalOpen} onOpenChange={handleModalOpenChange}>
              <DialogTrigger asChild>
                <Button size="icon" variant="outline">
                  +
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Send new message</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Phone number</label>
                    <Input
                      placeholder="E.164 format (e.g., +1234567890)"
                      value={newPhone}
                      onChange={(e) => {
                        setNewPhone(e.target.value);
                        if (phoneError) setPhoneError(null);
                      }}
                      disabled={sendMessage.isPending}
                      className={phoneError ? "border-red-500" : ""}
                    />
                    {phoneError && (
                      <Alert className="border-red-500 bg-red-50">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <AlertDescription className="text-red-600 text-sm">{phoneError}</AlertDescription>
                      </Alert>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Message</label>
                    <Textarea
                      placeholder="Type your message here..."
                      value={newText}
                      onChange={(e) => {
                        setNewText(e.target.value);
                        if (textError) setTextError(null);
                      }}
                      rows={4}
                      disabled={sendMessage.isPending}
                      className={textError ? "border-red-500" : ""}
                    />
                    {textError && (
                      <Alert className="border-red-500 bg-red-50">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <AlertDescription className="text-red-600 text-sm">{textError}</AlertDescription>
                      </Alert>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="ghost"
                    onClick={() => handleModalOpenChange(false)}
                    disabled={sendMessage.isPending}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSendNew} disabled={sendMessage.isPending}>
                    {sendMessage.isPending ? (
                      <>
                        <Spinner className="h-4 w-4 mr-2" />
                        Sending...
                      </>
                    ) : (
                      "Send"
                    )}
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
