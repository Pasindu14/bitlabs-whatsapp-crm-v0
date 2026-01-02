"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useArchiveConversation } from "../hooks/use-conversations";

type Props = {
  conversationId: number;
  isArchived: boolean;
};

export function ArchiveToggle({ conversationId, isArchived }: Props) {
  const archive = useArchiveConversation();

  const onToggle = () => {
    archive.mutate({ id: conversationId, archive: !isArchived });
  };

  return (
    <Button variant="outline" size="sm" onClick={onToggle} disabled={archive.isPending}>
      {archive.isPending ? <Spinner className="h-4 w-4" /> : isArchived ? "Unarchive" : "Archive"}
    </Button>
  );
}
