'use client';

import { useState, useRef } from 'react';
import { Upload, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { uploadImageAction } from '../actions/message-actions';
import { generateReactHelpers } from '@uploadthing/react';
import type { OurFileRouter } from '@/app/api/uploadthing/core';

interface ImageAttachmentPopoverProps {
  conversationId: number;
  onImageUploaded?: (url: string, key: string) => void;
  onSend?: (message: string, imageUrl?: string, imageKey?: string) => void;
}

const { useUploadThing } = generateReactHelpers<OurFileRouter>();

export function ImageAttachmentPopover({ conversationId, onImageUploaded, onSend }: ImageAttachmentPopoverProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { startUpload, isUploading } = useUploadThing('imageUploader', {
    onClientUploadComplete: async (uploaded) => {
      const uploadedFile = uploaded?.[0];
      if (!uploadedFile) {
        toast.error('Upload failed');
        return;
      }

      const result = await uploadImageAction({
        fileKey: uploadedFile.key,
        fileUrl: uploadedFile.url,
        fileName: uploadedFile.name,
        fileSize: uploadedFile.size,
        fileType: uploadedFile.type,
        conversationId,
      });

      console.log(result)
      if (result.ok) {
        onImageUploaded?.(uploadedFile.url, uploadedFile.key);
        console.log(result)
        toast.success('Image uploaded successfully');
        
        if (onSend) {
          onSend('', uploadedFile.url, uploadedFile.key);
        }
      } else {
        toast.error(result.error || 'Failed to save file');
      }
    },
    onUploadError: (error) => {
      toast.error(error.message || 'Upload failed');
    },
  });

  const handleFileSelect = async (file: File) => {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxSize = 4 * 1024 * 1024;

    if (!validTypes.includes(file.type)) {
      toast.error('Invalid file type. Please select JPEG, PNG, or WEBP.');
      return;
    }

    if (file.size > maxSize) {
      toast.error('File size exceeds 4MB limit.');
      return;
    }

    await startUpload([file]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      className="p-4"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {isUploading ? (
        <div className="flex flex-col items-center justify-center py-8 space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Uploading image...</p>
        </div>
      ) : (
        <div
          onClick={handleClick}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
            ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
          `}
        >
          <div className="flex flex-col items-center space-y-3">
            <div className="p-3 rounded-full bg-primary/10">
              {isDragging ? (
                <Upload className="h-6 w-6 text-primary" />
              ) : (
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {isDragging ? 'Drop image here' : 'Upload an image'}
              </p>
              <p className="text-xs text-muted-foreground">
                JPEG, PNG, or WEBP (max 4MB)
              </p>
            </div>
            <Button type="button" variant="secondary" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Browse Files
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
