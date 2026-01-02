'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useConversationStore } from '../store/conversation-store';
import { Plus, Send } from 'lucide-react';

interface MessageInputProps {
  onSend: (message: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function MessageInput({ onSend, isLoading = false, disabled = false }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const { openNewMessageModal } = useConversationStore();

  const handleSend = () => {
    if (message.trim()) {
      onSend(message);
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSend();
    }
  };

  return (
    <div className="border-t p-4 space-y-2">
      <div className="flex gap-2">
        <Button
          size="icon"
          variant="ghost"
          onClick={openNewMessageModal}
          disabled={disabled || isLoading}
          title="New message"
        >
          <Plus className="h-5 w-5" />
        </Button>
        <Textarea
          placeholder="Type a message... (Ctrl+Enter to send)"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isLoading}
          className="min-h-[40px] max-h-[120px] resize-none"
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={disabled || isLoading || !message.trim()}
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
