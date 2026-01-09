'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timestamp, setTimestamp] = useState(-1);
  const [loading, setLoading] = useState(false);
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

  useEffect(() => {
    if (revealed) {
      fetchMedia();
    }
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [revealed, fetchMedia]);

  const handleClick = () => {
    if (!revealed) {
      setRevealed(true);
    } else {
      // Force reload with new timestamp
      setTimestamp(Date.now());
      setError(null);
    }
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

  if (!revealed) {
    return (
      <div
        onClick={handleClick}
        className={`group relative aspect-square bg-gradient-to-br from-muted/60 via-muted/40 to-muted/80 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-muted/20 border border-border/50 hover:border-border p-1 ${className}`}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
      >
        {/* Subtle background pattern */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-transparent via-background/5 to-transparent opacity-50" />

        {/* Animated icon with glow effect */}
        <div className="relative mb-3">
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary/20 to-primary/10 blur-xl scale-150 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative p-3 rounded-full bg-gradient-to-br from-background/80 to-background/60 backdrop-blur-sm border border-border/30 group-hover:border-primary/30 transition-all duration-300 group-hover:shadow-md group-hover:shadow-primary/10">
            {React.cloneElement(getIcon(), {
              className: "h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors duration-300 drop-shadow-sm"
            })}
          </div>
        </div>

        {/* Enhanced text with better typography */}
        <div className="text-center px-3">
          <p className="text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors duration-300 leading-tight">
            View
          </p>
          {caption && (
            <p className="mt-2 text-xs text-muted-foreground/80 group-hover:text-muted-foreground transition-colors duration-300 text-center px-2 line-clamp-2 leading-relaxed">
              {caption}
            </p>
          )}
        </div>

        {/* Subtle corner accent */}
        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-gradient-to-r from-primary to-primary/70 opacity-60 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Hover ripple effect */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/5 via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      </div>
    );
  }

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
            className="w-full rounded-lg"
            style={{
              filter: 'brightness(0.95) contrast(1.1)',
              borderRadius: '0.5rem',
            }}
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
