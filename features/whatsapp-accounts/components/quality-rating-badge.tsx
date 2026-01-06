'use client';

import { Badge } from '@/components/ui/badge';
import type { QualityRating } from '../schemas/whatsapp-phone-profile.schema';

interface QualityRatingBadgeProps {
  rating?: QualityRating;
}

export function QualityRatingBadge({ rating }: QualityRatingBadgeProps) {
  if (!rating) {
    return null;
  }

  const variants: Record<QualityRating, { label: string; className: string }> = {
    GREEN: {
      label: 'High Quality',
      className: 'bg-green-500/10 text-green-700 border-green-500/20',
    },
    YELLOW: {
      label: 'Medium Quality',
      className: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20',
    },
    RED: {
      label: 'Low Quality',
      className: 'bg-red-500/10 text-red-700 border-red-500/20',
    },
    NA: {
      label: 'Not Available',
      className: 'bg-gray-500/10 text-gray-700 border-gray-500/20',
    },
  };

  const { label, className } = variants[rating];

  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  );
}
