'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, X } from 'lucide-react';
import { useAudioRecorder } from '../hooks/use-audio-recorder';

interface AudioRecorderProps {
  onStart: () => void;
  onStop: (blob: Blob, duration: number, mimeType: string) => void;
  onCancel: () => void;
}

export function AudioRecorder({ onStart, onStop, onCancel }: AudioRecorderProps) {
  const { isRecording, duration, blob, mimeType, error, startRecording, stopRecording, cancelRecording } = useAudioRecorder();

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStart = async () => {
    await startRecording();
    onStart();
  };

  const handleStop = () => {
    stopRecording();
  };

  const handleCancel = () => {
    cancelRecording();
    onCancel();
  };

  useEffect(() => {
    if (blob && mimeType && !isRecording) {
      onStop(blob, duration, mimeType);
    }
  }, [blob, mimeType, isRecording, duration, onStop]);

  if (error) {
    return (
      <div className="flex items-center gap-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
        <X className="h-4 w-4 text-destructive flex-shrink-0" />
        <p className="text-sm text-destructive flex-1">{error}</p>
        <Button size="sm" variant="ghost" onClick={handleCancel}>
          Dismiss
        </Button>
      </div>
    );
  }

  if (isRecording) {
    return (
      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
        <div className="relative">
          <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-75" />
          <div className="relative bg-red-500 rounded-full p-2">
            <Mic className="h-4 w-4 text-white" />
          </div>
        </div>
        
        <div className="flex-1">
          <p className="text-sm font-medium">Recording audio...</p>
          <p className="text-lg font-mono font-bold">{formatDuration(duration)}</p>
        </div>

        <Button size="icon" variant="ghost" onClick={handleCancel} title="Cancel">
          <X className="h-4 w-4" />
        </Button>

        <Button size="icon" onClick={handleStop} title="Stop recording">
          <Square className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <Button onClick={handleStart} variant="ghost" size="sm" className="w-full justify-start">
      <Mic className="h-4 w-4 mr-2" />
      Start Recording
    </Button>
  );
}
