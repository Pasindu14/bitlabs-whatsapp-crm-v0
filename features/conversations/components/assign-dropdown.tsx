"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { useAssignConversation } from "../hooks/use-conversations";

// For now, accepts a list of users passed in; in a real app, fetch users.
type Props = {
  conversationId: number;
  assignedTo: number | null;
  users: { id: number; name: string }[];
};

export function AssignDropdown({ conversationId, assignedTo, users }: Props) {
  const assign = useAssignConversation();
  const [open, setOpen] = useState(false);

  const current = users.find((u) => u.id === assignedTo)?.name ?? "Unassigned";

  const onAssign = (userId: number | null) => {
    assign.mutate({ id: conversationId, assignedTo: userId });
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={assign.isPending}>
          {assign.isPending ? <Spinner className="h-4 w-4" /> : `Assign: ${current}`}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onAssign(null)}>Unassigned</DropdownMenuItem>
        {users.map((u) => (
          <DropdownMenuItem key={u.id} onClick={() => onAssign(u.id)}>
            {u.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
