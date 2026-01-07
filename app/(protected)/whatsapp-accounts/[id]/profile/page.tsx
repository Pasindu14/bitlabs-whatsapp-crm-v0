
'use client';

import { useWhatsappPhoneProfile } from '@/features/whatsapp-accounts/hooks/use-whatsapp-phone-profile';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { RefreshCw, Smartphone, Shield, CheckCircle, Server, Activity, Webhook } from 'lucide-react';
import { QualityRatingBadge } from '@/features/whatsapp-accounts/components/quality-rating-badge';
import { VerificationStatusBadge } from '@/features/whatsapp-accounts/components/verification-status-badge';
import type { WhatsappPhoneProfileResponse } from '@/features/whatsapp-accounts/schemas/whatsapp-phone-profile.schema';
import { getWhatsappAccountAction } from '@/features/whatsapp-accounts/actions/whatsapp-account.actions';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

interface WhatsappAccount {
  id: number;
  name: string;
  phoneNumberId: string;
}

export default function WhatsAppPhoneProfilePage() {
  const params = useParams();
  const accountId = params.id ? parseInt(params.id as string, 10) : null;



  return (
    <div className="px-10 py-6">
      <div className="mb-6 space-y-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/whatsapp-accounts">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-semibold tracking-tight">WhatsApp Profile Meta Data</h1>
            <p className="text-sm text-muted-foreground">
              View and manage your WhatsApp Business phone profile settings and verification status
            </p>
          </div>
        </div>
      </div>

      <div className='mx-auto container'>{accountId && <WhatsAppPhoneProfileContent accountId={accountId} />}</div>
    </div>
  );
}

function WhatsAppPhoneProfileContent({ accountId }: { accountId: number }) {
  return (
    <div className="max-w-2xl mx-auto">
      <ProfileView accountId={accountId} />
    </div>
  );
}

function ProfileView({ accountId }: { accountId: number }) {
  const [account, setAccount] = useState<WhatsappAccount | null>(null);

  useEffect(() => {
    async function loadAccount() {
      try {
        const result = await getWhatsappAccountAction({ id: accountId, companyId: 0 });
        setAccount(result.ok ? (result.data || null) : null);
      } catch (error) {
        console.error('Failed to load account:', error);
        setAccount(null);
      }
    }

    loadAccount();
  }, [accountId]);

  const { data: profile, isLoading, error, refetch } = useWhatsappPhoneProfile({
    phoneNumberId: account?.phoneNumberId || '',
    includeNameStatus: true,
    includeCodeVerification: true,
  });

  if (!account) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Phone Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-16">
            <Spinner />
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
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Phone Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-16">
            <Spinner />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Phone Profile</CardTitle>
        <Button variant="ghost" size="icon" onClick={() => refetch()} aria-label="Refresh profile">
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

        {profile.platform_type && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Server className="h-4 w-4" />
              <span>Platform Type</span>
            </div>
            <p className="text-lg font-semibold">{profile.platform_type}</p>
          </div>
        )}

        {profile.throughput?.level && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Activity className="h-4 w-4" />
              <span>Throughput Level</span>
            </div>
            <p className="text-lg font-semibold">{profile.throughput.level}</p>
          </div>
        )}

        {profile.webhook_configuration?.application && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Webhook className="h-4 w-4" />
              <span>Webhook URL</span>
            </div>
            <p className="text-sm font-mono break-all">{profile.webhook_configuration.application}</p>
          </div>
        )}

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
