'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { assignConversationToUserAction } from '../actions/conversation-actions';
import { conversationKeys } from '../hooks/conversation-hooks';
import { listUsersAction } from '@/features/users/actions/user.actions';
import type { UserResponse } from '@/features/users/schemas/user.schema';

const assignUserSchema = z.object({
  userId: z.string().min(1, 'Please select a user'),
});

type AssignUserForm = z.infer<typeof assignUserSchema>;

interface AssignUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: number;
  currentAssignedUserId: number | null;
}

export function AssignUserDialog({
  open,
  onOpenChange,
  conversationId,
  currentAssignedUserId,
}: AssignUserDialogProps) {
  const session = useSession();
  const queryClient = useQueryClient();
  
  const form = useForm<AssignUserForm>({
    resolver: zodResolver(assignUserSchema),
    defaultValues: {
      userId: currentAssignedUserId?.toString() || '',
    },
  });

  const { data: usersData, isLoading: isLoadingUsers } = useQuery({
    queryKey: ['users', 'list', 'all'],
    queryFn: async () => {
      const result = await listUsersAction({
        limit: 100,
        sortField: 'name',
        sortOrder: 'asc',
      });
      if (!result.ok) throw new Error(result.error || 'Failed to load users');
      return result.data;
    },
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: async (data: AssignUserForm) => {
      const result = await assignConversationToUserAction({
        conversationId,
        userId: data.userId === 'unassign' ? null : parseInt(data.userId, 10),
      });
      if (!result.ok) throw new Error(result.error || 'Failed to assign user');
      return result.data;
    },
    onSuccess: () => {
      toast.success('User assigned successfully');
      onOpenChange(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: conversationKeys.all });
      queryClient.invalidateQueries({ queryKey: conversationKeys.details() });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to assign user');
    },
  });

  const onSubmit = (data: AssignUserForm) => {
    mutation.mutate(data);
  };

  const users = usersData?.items || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Assign User</DialogTitle>
          <DialogDescription>
            Select a user to assign this conversation to. Only the assigned user will be able to update the contact name.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="userId">User</Label>
              <Select
                value={form.watch('userId')}
                onValueChange={(value) => form.setValue('userId', value)}
                disabled={mutation.isPending || isLoadingUsers}
              >
                <SelectTrigger id="userId" className='w-full'>
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassign">Unassigned (Anyone can update)</SelectItem>
                  {users.map((user: UserResponse) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.userId && (
                <p className="text-sm text-destructive">{form.formState.errors.userId.message}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending || isLoadingUsers}>
              {mutation.isPending ? 'Assigning...' : 'Assign'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
