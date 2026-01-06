'use client';

import { useWhatsappAccounts } from '@/features/whatsapp-accounts/hooks/use-whatsapp-accounts';
import { toast } from 'sonner';

const WHATSAPP_ACCOUNT_SELECTED_KEY = 'selected-whatsapp-account-id';

export function useSelectedWhatsappAccount() {
  const { data: accountsData, isLoading: isLoadingAccounts, error: accountsError } = useWhatsappAccounts({
    isActive: true,
    limit: 100,
    sortField: 'createdAt',
    sortOrder: 'desc',
  });

  const allAccounts = accountsData?.pages.flatMap((page) => page.items) || [];
  const defaultAccount = allAccounts.find((acc) => acc.isDefault) || allAccounts[0] || null;

  const selectedAccountId = typeof window !== 'undefined'
    ? (localStorage.getItem(WHATSAPP_ACCOUNT_SELECTED_KEY)
        ? parseInt(localStorage.getItem(WHATSAPP_ACCOUNT_SELECTED_KEY)!, 10)
        : null)
    : null;

  const selectedAccount = allAccounts.find((acc) => acc.id === selectedAccountId) || defaultAccount;

  const selectAccount = (accountId: number | null) => {
    if (typeof window !== 'undefined') {
      if (accountId === null) {
        localStorage.removeItem(WHATSAPP_ACCOUNT_SELECTED_KEY);
      } else {
        localStorage.setItem(WHATSAPP_ACCOUNT_SELECTED_KEY, accountId.toString());
      }
    }
  };

  if (accountsError) {
    toast.error('Failed to load WhatsApp accounts');
  }

  return {
    selectedAccount,
    allAccounts,
    isLoading: isLoadingAccounts,
    error: accountsError,
    selectAccount,
  };
}
