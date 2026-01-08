'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useUpdateOrder } from '../hooks/order-hooks';
import { orderUpdateClientSchema, type OrderUpdateClientInput } from '../schemas/order-schema';
import { toast } from 'sonner';

interface UpdateOrderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: number;
  currentData: {
    customerName: string;
    customerPhone: string;
    deliveryAddress: string;
    orderDescription: string;
    notes: string;
  };
}

export function UpdateOrderDialog({ isOpen, onClose, orderId, currentData }: UpdateOrderDialogProps) {
  const updateOrderMutation = useUpdateOrder();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<OrderUpdateClientInput>({
    resolver: zodResolver(orderUpdateClientSchema),
    defaultValues: {
      orderId,
      customerName: currentData.customerName,
      customerPhone: currentData.customerPhone,
      deliveryAddress: currentData.deliveryAddress,
      orderDescription: currentData.orderDescription,
      notes: currentData.notes,
    },
  });

  const handleClose = () => {
    form.reset();
    onClose();
  };

  const onSubmit = async (data: OrderUpdateClientInput) => {
    setIsSubmitting(true);
    try {
      await updateOrderMutation.mutateAsync(data);
      toast.success('Order updated successfully');
      handleClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update order');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Update Order</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="customerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter customer name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="customerPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter phone number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="deliveryAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Delivery Address *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter delivery address"
                        className="resize-none"
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="orderDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Order Description *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter order description"
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter additional notes"
                        className="resize-none"
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" onClick={form.handleSubmit(onSubmit)} disabled={isSubmitting}>
            {isSubmitting ? 'Updating...' : 'Update Order'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
