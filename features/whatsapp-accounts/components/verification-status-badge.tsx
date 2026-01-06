'use client';

import { Badge } from '@/components/ui/badge';
import type { NameStatus, CodeVerificationStatus } from '../schemas/whatsapp-phone-profile.schema';

interface VerificationStatusBadgeProps {
  type: 'name' | 'code';
  status?: NameStatus | CodeVerificationStatus;
}

export function VerificationStatusBadge({ type, status }: VerificationStatusBadgeProps) {
  if (!status) {
    return null;
  }

  const nameStatusVariants: Record<NameStatus, { label: string; className: string }> = {
    APPROVED: {
      label: 'Approved',
      className: 'bg-green-500/10 text-green-700 border-green-500/20',
    },
    AVAILABLE_WITHOUT_REVIEW: {
      label: 'Available',
      className: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
    },
    DECLINED: {
      label: 'Declined',
      className: 'bg-red-500/10 text-red-700 border-red-500/20',
    },
    EXPIRED: {
      label: 'Expired',
      className: 'bg-orange-500/10 text-orange-700 border-orange-500/20',
    },
    PENDING_REVIEW: {
      label: 'Pending Review',
      className: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20',
    },
    NONE: {
      label: 'None',
      className: 'bg-gray-500/10 text-gray-700 border-gray-500/20',
    },
  };

  const codeStatusVariants: Record<CodeVerificationStatus, { label: string; className: string }> = {
    VERIFIED: {
      label: 'Verified',
      className: 'bg-green-500/10 text-green-700 border-green-500/20',
    },
    UNVERIFIED: {
      label: 'Unverified',
      className: 'bg-red-500/10 text-red-700 border-red-500/20',
    },
    EXPIRED: {
      label: 'Expired',
      className: 'bg-orange-500/10 text-orange-700 border-orange-500/20',
    },
    PENDING: {
      label: 'Pending',
      className: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20',
    },
    NOT_VERIFIED: {
      label: 'Not Verified',
      className: 'bg-gray-500/10 text-gray-700 border-gray-500/20',
    },
  };

  const variants = type === 'name' ? nameStatusVariants : codeStatusVariants;
  const { label, className } = variants[status as keyof typeof variants];

  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  );
}
