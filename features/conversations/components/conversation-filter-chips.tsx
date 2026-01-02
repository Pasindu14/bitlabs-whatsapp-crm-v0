'use client';

import { Button } from '@/components/ui/button';
import { useConversationStore } from '../store/conversation-store';
import type { ConversationFilterType } from '../schemas/conversation-schema';

const FILTER_OPTIONS: { label: string; value: ConversationFilterType }[] = [
  { label: 'All', value: 'all' },
  { label: 'Unread', value: 'unread' },
  { label: 'Favorites', value: 'favorites' },
  { label: 'Groups', value: 'groups' },
];

export function ConversationFilterChips() {
  const { filterType, setFilterType } = useConversationStore();

  return (
    <div className="flex gap-2 overflow-x-auto px-4 py-2">
      {FILTER_OPTIONS.map((option) => (
        <Button
          key={option.value}
          variant={filterType === option.value ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterType(option.value)}
          className="whitespace-nowrap"
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
