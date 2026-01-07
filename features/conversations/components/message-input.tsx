'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useConversationStore } from '../store/conversation-store';
import { Plus, Send, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { ImageAttachmentPopover } from './image-attachment-popover';

interface MessageInputProps {
  onSend: (message: string, imageUrl?: string, imageKey?: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
  conversationId: number;
}

export function MessageInput({ onSend, isLoading = false, disabled = false, conversationId }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const { selectedImage, clearSelectedImage } = useConversationStore();

  const handleSend = () => {
    if (message.trim() || selectedImage?.uploadUrl) {
      onSend(message, selectedImage?.uploadUrl, selectedImage?.uploadKey);
      setMessage('');
      clearSelectedImage();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSend();
    }
  };

  const handleRemoveImage = () => {
    clearSelectedImage();
  };

  const handleImageUploaded = () => {
    setIsPopoverOpen(false);
  };

  return (
    <div className="border-t p-4 space-y-2">
      {selectedImage && (
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
          <div className="relative w-16 h-16 rounded-md overflow-hidden bg-muted">
            <Image
              src={selectedImage.previewUrl}
              alt="Preview"
              fill
              className="object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{selectedImage.file.name}</p>
            <p className="text-xs text-muted-foreground">
              {(selectedImage.file.size / 1024).toFixed(1)} KB
            </p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleRemoveImage}
            disabled={isLoading}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="flex gap-2 items-center justify-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              disabled={disabled || isLoading}
              title="Attach"
              className="border"
            >
              <Plus className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-48">
            <DropdownMenuLabel>Attach</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setIsPopoverOpen(true);
              }}
            >
              <ImageIcon className="h-4 w-4 mr-2" />
              Photos & videos
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Dialog open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
          <DialogContent className="w-80 p-0">
            <DialogHeader className="p-4 pb-0">
              <DialogTitle>Upload Image</DialogTitle>
            </DialogHeader>
            <ImageAttachmentPopover
              conversationId={conversationId}
              onImageUploaded={handleImageUploaded}
              onSend={onSend}
            />
          </DialogContent>
        </Dialog>

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
          disabled={disabled || isLoading || (!message.trim() && !selectedImage?.uploadUrl)}
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </Button>
      </div>
    </div>
  );
}
