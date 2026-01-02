"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useSendMessage } from "../hooks/use-messages";

interface Props {
  conversationId: number | null;
}

export function MessageComposer({ conversationId }: Props) {
  const [text, setText] = useState("");
  const send = useSendMessage();

  const disabled = !conversationId || send.isPending || !text.trim();

  const onSend = async () => {
    if (!conversationId || !text.trim()) return;
    await send.mutateAsync({ conversationId, type: "text", content: { text } });
    setText("");
  };

  return (
    <div className="flex items-center gap-2 border-t p-3">
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type a message"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        }}
        disabled={!conversationId || send.isPending}
      />
      <Button onClick={onSend} disabled={disabled}>
        {send.isPending ? <Spinner className="h-4 w-4" /> : "Send"}
      </Button>
    </div>
  );
}
