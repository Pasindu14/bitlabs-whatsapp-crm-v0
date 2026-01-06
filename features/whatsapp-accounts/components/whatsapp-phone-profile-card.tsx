'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { RefreshCw, Smartphone, Shield, CheckCircle } from 'lucide-react';
import { QualityRatingBadge } from './quality-rating-badge';
import { VerificationStatusBadge } from './verification-status-badge';
import type { WhatsappPhoneProfileResponse } from '../schemas/whatsapp-phone-profile.schema';

interface WhatsAppPhoneProfileCardProps {
  profile: WhatsappPhoneProfileResponse | null | undefined;
  isLoading: boolean;
  error: Error | null;
  onRefresh: () => void;
}

export function WhatsAppPhoneProfileCard({ profile, isLoading, error, onRefresh }: WhatsAppPhoneProfileCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Phone Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-6 w-48" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-40" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-6 w-36" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="flex items-center justify-between">
          <span>{error.message}</span>
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!profile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Phone Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No profile data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Phone Profile</CardTitle>
        <Button variant="ghost" size="icon" onClick={onRefresh} aria-label="Refresh profile">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Smartphone className="h-4 w-4" />
            <span>Phone Number ID</span>
          </div>
          <p className="text-lg font-semibold">{profile.id}</p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Smartphone className="h-4 w-4" />
            <span>Phone Number</span>
          </div>
          <p className="text-lg font-semibold">{profile.display_phone_number}</p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="h-4 w-4" />
            <span>Verified Name</span>
          </div>
          <p className="text-lg font-semibold">{profile.verified_name}</p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle className="h-4 w-4" />
            <span>Quality Rating</span>
          </div>
          <QualityRatingBadge rating={profile.quality_rating} />
        </div>

        {profile.name_status && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4" />
              <span>Name Status</span>
            </div>
            <VerificationStatusBadge type="name" status={profile.name_status} />
          </div>
        )}

        {profile.code_verification_status && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4" />
              <span>Code Verification</span>
            </div>
            <VerificationStatusBadge type="code" status={profile.code_verification_status} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
