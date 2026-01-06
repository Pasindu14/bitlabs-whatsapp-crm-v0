
'use client';

import { WhatsAppPhoneProfileCard } from '@/features/whatsapp-accounts/components/whatsapp-phone-profile-card';
import { getWhatsappAccountAction } from '@/features/whatsapp-accounts/actions/whatsapp-account.actions';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  const [account, setAccount] = useState<WhatsappAccount | null | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  const accountId = params.id ? parseInt(params.id as string, 10) : null;

  useEffect(() => {
    async function loadAccount() {
      if (!accountId || isNaN(accountId) || accountId <= 0) {
        setAccount(null);
        setIsLoading(false);
        return;
      }

      try {
        const result = await getWhatsappAccountAction({ id: accountId, companyId: 0 });
        setAccount(result.ok ? result.data : null);
      } catch (error) {
        console.error('Failed to load account:', error);
        setAccount(null);
      } finally {
        setIsLoading(false);
      }
    }

    loadAccount();
  }, [accountId]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="mb-6">
          <Link href="/whatsapp-accounts">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Accounts
            </Button>
          </Link>
        </div>
        <div>Loading account...</div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="container mx-auto py-8">
        <div className="mb-6">
          <Link href="/whatsapp-accounts">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Accounts
            </Button>
          </Link>
        </div>
        <div>{!accountId || isNaN(accountId) || accountId <= 0 ? 'Invalid account ID' : 'Account not found'}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <Link href="/whatsapp-accounts">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Accounts
          </Button>
        </Link>
      </div>
      <WhatsAppPhoneProfileContent phoneNumberId={account.phoneNumberId} accountName={account.name} />
    </div>
  );
}

function WhatsAppPhoneProfileContent({ phoneNumberId, accountName }: { phoneNumberId: string; accountName: string }) {
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{accountName} - Phone Profile</h1>
      <ProfileView phoneNumberId={phoneNumberId} />
    </div>
  );
}

import { useWhatsappPhoneProfile } from '@/features/whatsapp-accounts/hooks/use-whatsapp-phone-profile';

function ProfileView({ phoneNumberId }: { phoneNumberId: string }) {
  const { data: profile, isLoading, error, refetch } = useWhatsappPhoneProfile({
    phoneNumberId,
    includeNameStatus: true,
    includeCodeVerification: true,
  });

  return (
    <WhatsAppPhoneProfileCard
      profile={profile}
      isLoading={isLoading}
      error={error}
      onRefresh={() => refetch()}
    />
  );
}
