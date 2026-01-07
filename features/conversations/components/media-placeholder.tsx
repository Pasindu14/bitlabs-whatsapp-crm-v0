'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Image, Video, FileAudio, FileText, RefreshCw } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import axios from 'axios';

interface MediaPlaceholderProps {
  mediaId: string;
  mediaType: 'image' | 'video' | 'audio' | 'document';
  caption?: string;
  className?: string;
}

export function MediaPlaceholder({
  mediaId,
  mediaType,
  caption,
  className = '',
}: MediaPlaceholderProps) {
  const [error, setError] = useState<string | null>(null);
  const [timestamp, setTimestamp] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const fetchMedia = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Only add timestamp if it's a reload (timestamp > 0)
      const url = timestamp > 0 
        ? `/api/whatsapp/media/${mediaId}?t=${timestamp}`
        : `/api/whatsapp/media/${mediaId}`;
      
      const response = await axios.get(url, {
        responseType: 'blob',
      });
      
      // Revoke previous object URL if exists
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      
      // Create new object URL
      const blobUrl = URL.createObjectURL(response.data);
      objectUrlRef.current = blobUrl;
      setMediaUrl(blobUrl);
      setLoading(false);
    } catch (_err) {
      setLoading(false);
      setError('Failed to load. Tap to retry.');
    }
  }, [mediaId, timestamp]);

  // Auto-fetch on mount
  useEffect(() => {
    fetchMedia();
    // Cleanup on unmount
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, [fetchMedia]);

  const handleClick = () => {
    // Force reload with new timestamp
    setTimestamp(Date.now());
    setError(null);
  };

  const getIcon = () => {
    switch (mediaType) {
      case 'image':
        return <Image className="h-12 w-12 text-muted-foreground" aria-hidden="true" />;
      case 'video':
        return <Video className="h-12 w-12 text-muted-foreground" aria-hidden="true" />;
      case 'audio':
        return <FileAudio className="h-12 w-12 text-muted-foreground" aria-hidden="true" />;
      case 'document':
        return <FileText className="h-12 w-12 text-muted-foreground" aria-hidden="true" />;
      default:
        return <Image className="h-12 w-12 text-muted-foreground" aria-hidden="true" />;
    }
  };

  if (error) {
    return (
      <div
        onClick={handleClick}
        className={`relative aspect-square bg-destructive/10 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-destructive/20 transition-colors ${className}`}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
      >
        <RefreshCw className="h-12 w-12 text-destructive" />
        <p className="mt-2 text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`relative aspect-square bg-muted/50 rounded-lg flex items-center justify-center ${className}`} aria-label="Loading media">
        <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
      </div>
    );
  }

  if (mediaType === 'image') {
    return (
      <div onClick={handleClick} className={`relative rounded-lg overflow-hidden cursor-pointer ${className}`} role="button" tabIndex={0} onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}>
        {mediaUrl && (
          <img
            src={mediaUrl}
            alt={caption || 'Image'}
            className="w-full h-full object-cover"
          />
        )}
      </div>
    );
  }

  if (mediaType === 'video') {
    return (
      <div onClick={handleClick} className={`relative rounded-lg overflow-hidden cursor-pointer ${className}`} role="button" tabIndex={0} onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}>
        {mediaUrl && (
          <video
            src={mediaUrl}
            controls
            className="w-full h-full object-cover"
          />
        )}
      </div>
    );
  }

  if (mediaType === 'audio') {
    return (
      <div onClick={handleClick} className={`relative rounded-lg overflow-hidden cursor-pointer bg-muted/50 p-4 ${className}`} role="button" tabIndex={0} onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}>
        {mediaUrl && (
          <audio
            src={mediaUrl}
            controls
            className="w-full"
          />
        )}
      </div>
    );
  }

  if (mediaType === 'document') {
    return (
      <div
        onClick={() => mediaUrl && window.open(mediaUrl, '_blank')}
        className={`relative aspect-square bg-muted/50 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-muted/70 transition-colors ${className}`}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (mediaUrl) {
              window.open(mediaUrl, '_blank');
            }
          }
        }}
      >
        {getIcon()}
        <p className="mt-2 text-sm text-muted-foreground text-center px-2">
          {caption || 'Document'}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Tap to open</p>
      </div>
    );
  }

  return null;
}
