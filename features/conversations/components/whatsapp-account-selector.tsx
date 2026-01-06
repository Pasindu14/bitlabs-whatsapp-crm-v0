'use client';

import { Check, Smartphone } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSelectedWhatsappAccount } from '../hooks/use-selected-whatsapp-account';
import { Skeleton } from '@/components/ui/skeleton';

export function WhatsAppAccountSelector() {
  const { selectedAccount, allAccounts, isLoading, selectAccount } = useSelectedWhatsappAccount();

  if (isLoading) {
    return (
      <div className="w-full">
        <Skeleton className="h-9 w-full" />
      </div>
    );
  }

  if (allAccounts.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Smartphone className="h-4 w-4" />
        <span>No accounts configured</span>
      </div>
    );
  }

  return (
    <Select
      value={selectedAccount?.id?.toString() || ''}
      onValueChange={(value) => selectAccount(value ? parseInt(value, 10) : null)}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select account">
          {selectedAccount && (
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{selectedAccount.name}</span>
              {selectedAccount.isDefault && (
                <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                  Default
                </span>
              )}
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {allAccounts.map((account) => (
          <SelectItem key={account.id} value={account.id.toString()}>
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{account.name}</span>
              {account.isDefault && (
                <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                  Default
                </span>
              )}
              {selectedAccount?.id === account.id && (
                <Check className="h-4 w-4 ml-auto" />
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
