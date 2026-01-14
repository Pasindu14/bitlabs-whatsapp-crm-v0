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
import { Plus, Send, X, Loader2, Image as ImageIcon, Mic } from 'lucide-react';
import { ImageAttachmentPopover } from './image-attachment-popover';
import { AudioRecorder } from './audio-recorder';
import { AudioPreview } from './audio-preview';
import { generateReactHelpers } from '@uploadthing/react';
import type { OurFileRouter } from '@/app/api/uploadthing/core';
import { uploadMediaAction } from '../actions/message-actions';
import { toast } from 'sonner';
import { convertToMp3, normalizeMimeType, getFileExtension } from '@/lib/audio-converter';

interface MessageInputProps {
  onSend: (message: string, imageUrl?: string, imageKey?: string, audioUrl?: string, audioKey?: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
  conversationId: number;
}

const { useUploadThing } = generateReactHelpers<OurFileRouter>();

export function MessageInput({ onSend, isLoading = false, disabled = false, conversationId }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const { selectedImage, clearSelectedImage, audioRecording, setAudioRecording, clearAudioRecording } = useConversationStore();

  const { startUpload: startImageUpload } = useUploadThing('imageUploader', {
    onClientUploadComplete: async (uploaded) => {
      const uploadedFile = uploaded?.[0];
      if (!uploadedFile) {
        toast.error('Upload failed');
        setIsUploading(false);
        return;
      }

      const result = await uploadMediaAction({
        fileKey: uploadedFile.key,
        fileUrl: uploadedFile.url,
        fileName: uploadedFile.name,
        fileSize: uploadedFile.size,
        fileType: uploadedFile.type,
        conversationId,
      });

      setIsUploading(false);

      if (result.ok) {
        onSend(message, uploadedFile.url, uploadedFile.key);
        setMessage('');
        clearSelectedImage();
        toast.success('Image sent successfully');
      } else {
        toast.error(result.error || 'Failed to upload image');
      }
    },
    onUploadError: (error) => {
      toast.error(error.message || 'Upload failed');
      setIsUploading(false);
    },
  });

  const { startUpload: startAudioUpload } = useUploadThing('audioUploader', {
    onClientUploadComplete: async (uploaded) => {
      const uploadedFile = uploaded?.[0];
      if (!uploadedFile) {
        toast.error('Upload failed');
        setIsUploading(false);
        return;
      }

      const result = await uploadMediaAction({
        fileKey: uploadedFile.key,
        fileUrl: uploadedFile.url,
        fileName: uploadedFile.name,
        fileSize: uploadedFile.size,
        fileType: uploadedFile.type,
        conversationId,
      });

      setIsUploading(false);

      if (result.ok) {
        onSend(message, undefined, undefined, uploadedFile.url, uploadedFile.key);
        setMessage('');
        clearAudioRecording();
        toast.success('Audio message sent');
      } else {
        toast.error(result.error || 'Failed to upload audio');
      }
    },
    onUploadError: (error) => {
      toast.error(error.message || 'Upload failed');
      setIsUploading(false);
    },
  });

  const handleSend = async () => {
    if (selectedImage?.file) {
      setIsUploading(true);
      await startImageUpload([selectedImage.file]);
    } else if (audioRecording?.blob) {
      setIsUploading(true);
      try {
        const mp3File = await convertToMp3(audioRecording.blob);
        await startAudioUpload([mp3File]);
      } catch (error) {
        toast.error('Failed to convert audio to MP3');
        setIsUploading(false);
      }
    } else if (message.trim()) {
      onSend(message);
      setMessage('');
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

  const handleRecordingStart = () => {
    setIsRecording(true);
  };

  const handleRecordingStop = (blob: Blob, duration: number, mimeType: string) => {
    setIsRecording(false);
    setAudioRecording({ blob, duration, mimeType });
  };

  const handleRecordingCancel = () => {
    setIsRecording(false);
  };

  const handleDeleteAudio = () => {
    clearAudioRecording();
  };

  const handleRerecord = () => {
    clearAudioRecording();
    setIsRecording(true);
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

      {audioRecording && !isRecording && (
        <AudioPreview
          blob={audioRecording.blob}
          duration={audioRecording.duration}
          onDelete={handleDeleteAudio}
          onRerecord={handleRerecord}
        />
      )}

      {isRecording && (
        <AudioRecorder
          onStart={handleRecordingStart}
          onStop={handleRecordingStop}
          onCancel={handleRecordingCancel}
        />
      )}

      <div className="flex gap-2 items-center justify-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              disabled={disabled || isLoading || isRecording}
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
              onSelect={() => {
                setIsPopoverOpen(true);
              }}
            >
              <ImageIcon className="h-4 w-4 mr-2" />
              Photos & videos
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                setIsRecording(true);
              }}
            >
              <Mic className="h-4 w-4 mr-2" />
              Audio
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
            />
          </DialogContent>
        </Dialog>

        <Textarea
          placeholder="Type a message... (Ctrl+Enter to send)"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isLoading || isRecording}
          className="min-h-[40px] max-h-[120px] resize-none"
        />

        <Button
          size="icon"
          onClick={handleSend}
          disabled={disabled || isLoading || isUploading || (!message.trim() && !selectedImage?.file && !audioRecording?.blob)}
        >
          {isLoading || isUploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </Button>
      </div>
    </div>
  );
}
