import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createOrderAction,
  updateOrderAction,
  updateOrderStatusAction,
  deactivateOrderAction,
  getOrderByIdAction,
  listOrdersAction,
} from '../actions/order-actions';
import type {
  OrderCreateClientInput,
  OrderUpdateClientInput,
  OrderUpdateStatusInput,
  OrderDeactivateInput,
  OrderListInput,
} from '../schemas/order-schema';

export const orderKeys = {
  all: ['orders'] as const,
  lists: () => [...orderKeys.all, 'list'] as const,
  list: (filters: string) => [...orderKeys.lists(), filters] as const,
  details: () => [...orderKeys.all, 'detail'] as const,
  detail: (orderId: number) => [...orderKeys.details(), orderId] as const,
};

function getFilterKey(filters: OrderListInput): string {
  return JSON.stringify({
    cursor: filters.cursor,
    limit: filters.limit,
    status: filters.status,
    searchTerm: filters.searchTerm,
    contactId: filters.contactId,
    conversationId: filters.conversationId,
  });
}

export function useOrders(filters: OrderListInput) {
  return useQuery({
    queryKey: orderKeys.list(getFilterKey(filters)),
    queryFn: async () => {
      const result = await listOrdersAction(filters);
      if (!result.ok) throw new Error(result.error || 'Failed to load orders');
      return result.data;
    },
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
}

export function useOrder(orderId: number | null, companyId: number) {
  return useQuery({
    queryKey: orderKeys.detail(orderId || 0),
    queryFn: async () => {
      if (!orderId) throw new Error('Order ID is required');
      const result = await getOrderByIdAction({ orderId, companyId });
      if (!result.ok) throw new Error(result.error || 'Failed to load order');
      return result.data;
    },
    enabled: !!orderId,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: OrderCreateClientInput) => {
      const result = await createOrderAction(input);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: orderKeys.all,
      });
    },
    retry: false,
  });
}

export function useUpdateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: OrderUpdateClientInput) => {
      const result = await updateOrderAction(input);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (data) => {
      if (!data) return;
      queryClient.invalidateQueries({
        queryKey: orderKeys.detail(data.id),
      });
      queryClient.invalidateQueries({
        queryKey: orderKeys.all,
      });
    },
    retry: false,
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: OrderUpdateStatusInput) => {
      const result = await updateOrderStatusAction(input);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (data) => {
      if (!data) return;
      queryClient.invalidateQueries({
        queryKey: orderKeys.detail(data.id),
      });
      queryClient.invalidateQueries({
        queryKey: orderKeys.all,
      });
    },
    retry: false,
  });
}

export function useDeactivateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: OrderDeactivateInput) => {
      const result = await deactivateOrderAction(input);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: orderKeys.detail(variables.orderId),
      });
      queryClient.invalidateQueries({
        queryKey: orderKeys.all,
      });
    },
    retry: false,
  });
}
