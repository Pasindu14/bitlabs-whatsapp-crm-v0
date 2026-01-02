'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useSendNewMessage } from '../hooks/conversation-hooks';
import { useConversationStore } from '../store/conversation-store';
import { sendNewMessageClientSchema } from '../schemas/conversation-schema';
import type { SendNewMessageInput } from '../schemas/conversation-schema';
import { toast } from 'sonner';
import { Loader2, X } from 'lucide-react';

export function NewMessageModal() {
  const { isNewMessageModalOpen, closeNewMessageModal } = useConversationStore();
  const { mutate: sendMessage, isPending } = useSendNewMessage();

  const form = useForm<SendNewMessageInput>({
    resolver: zodResolver(sendNewMessageClientSchema),
    defaultValues: {
      phoneNumber: '',
      messageText: '',
    },
  });

  const onSubmit = (data: SendNewMessageInput) => {
    sendMessage(data, {
      onSuccess: () => {
        toast.success('Message sent successfully');
        form.reset();
        closeNewMessageModal();
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to send message');
      },
    });
  };

  return (
    <Dialog open={isNewMessageModalOpen} onOpenChange={closeNewMessageModal}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Send New Message</DialogTitle>
          <DialogClose asChild>
            <button className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
          </DialogClose>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="phoneNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="+1234567890"
                      {...field}
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="messageText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Type your message..."
                      className="min-h-[120px] resize-none"
                      {...field}
                      disabled={isPending}
                    />
                  </FormControl>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <FormMessage />
                    <span>{field.value.length}/4096</span>
                  </div>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={closeNewMessageModal}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending || !form.formState.isValid}
              >
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
