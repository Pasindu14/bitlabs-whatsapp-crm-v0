'use client';

import { Input } from '@/components/ui/input';
import { useConversationStore } from '../store/conversation-store';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ConversationSearch() {
  const { searchTerm, setSearchTerm } = useConversationStore();

  return (
    <div className="relative px-4 py-2">
      <Search className="absolute left-6 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Search conversations..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="pl-10 pr-10"
      />
      {searchTerm && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-5 top-1/2 -translate-y-1/2 h-auto p-0"
          onClick={() => setSearchTerm('')}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
