'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { updateContactNameAction } from '../actions/conversation-actions';
import { conversationKeys } from '../hooks/conversation-hooks';

const updateContactNameSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120, 'Name must be 120 characters or less'),
});

type UpdateContactNameForm = z.infer<typeof updateContactNameSchema>;

interface UpdateContactNameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: number;
  currentName: string;
}

export function UpdateContactNameDialog({
  open,
  onOpenChange,
  contactId,
  currentName,
}: UpdateContactNameDialogProps) {
  const queryClient = useQueryClient();
  
  const form = useForm<UpdateContactNameForm>({
    resolver: zodResolver(updateContactNameSchema),
    defaultValues: {
      name: currentName,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: UpdateContactNameForm) => {
      const result = await updateContactNameAction({
        contactId,
        name: data.name,
      });
      if (!result.ok) throw new Error(result.error || 'Failed to update contact name');
      return result.data;
    },
    onSuccess: () => {
      toast.success('Contact name updated successfully');
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: conversationKeys.all });
      queryClient.invalidateQueries({ queryKey: conversationKeys.details() });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update contact name');
    },
  });

  const onSubmit = (data: UpdateContactNameForm) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Update Contact Name</DialogTitle>
          <DialogDescription>
            Enter a new name for this contact.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                {...form.register('name')}
                placeholder="Enter contact name"
                disabled={mutation.isPending}
              />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
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
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Updating...' : 'Update'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
