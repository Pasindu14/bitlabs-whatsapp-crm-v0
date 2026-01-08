'use server';

import { withAction } from '@/lib/server-action-helper';
import { Result } from '@/lib/result';
import { OrderService } from '../services/order-service';
import {
  orderCreateClientSchema,
  orderUpdateClientSchema,
  orderUpdateStatusSchema,
  orderDeactivateSchema,
  orderGetByIdSchema,
  orderListSchema,
  type OrderCreateClientInput,
  type OrderUpdateClientInput,
  type OrderUpdateStatusInput,
  type OrderDeactivateInput,
  type OrderGetByIdInput,
  type OrderListInput,
  type OrderResponse,
  type OrderListResponse,
} from '../schemas/order-schema';

export const createOrderAction = withAction<OrderCreateClientInput, OrderResponse>(
  'orders.create',
  async (auth, input) => {
    const result = await OrderService.create({
      ...input,
      companyId: auth.companyId,
      userId: auth.userId,
    });
    if (!result.isOk) return result;

    return Result.ok(result.data, 'Order created successfully');
  },
  { schema: orderCreateClientSchema }
);

export const updateOrderAction = withAction<OrderUpdateClientInput, OrderResponse>(
  'orders.update',
  async (auth, input) => {
    const result = await OrderService.update({
      ...input,
      companyId: auth.companyId,
      userId: auth.userId,
    });
    if (!result.isOk) return result;

    return Result.ok(result.data, 'Order updated successfully');
  },
  { schema: orderUpdateClientSchema }
);

export const updateOrderStatusAction = withAction<OrderUpdateStatusInput, OrderResponse>(
  'orders.updateStatus',
  async (auth, input) => {
    const result = await OrderService.updateStatus({
      ...input,
      companyId: auth.companyId,
      userId: auth.userId,
    });
    if (!result.isOk) return result;

    return Result.ok(result.data, 'Order status updated successfully');
  },
  { schema: orderUpdateStatusSchema }
);

export const deactivateOrderAction = withAction<OrderDeactivateInput, { success: boolean }>(
  'orders.deactivate',
  async (auth, input) => {
    const result = await OrderService.deactivate({
      ...input,
      companyId: auth.companyId,
      userId: auth.userId,
    });
    if (!result.isOk) return result;

    return Result.ok({ success: true }, 'Order deactivated successfully');
  },
  { schema: orderDeactivateSchema }
);

export const getOrderByIdAction = withAction<OrderGetByIdInput, OrderResponse>(
  'orders.getById',
  async (auth, input) => {
    const result = await OrderService.getById({
      ...input,
      companyId: auth.companyId,
    });
    if (!result.isOk) return result;

    return Result.ok(result.data, 'Order loaded');
  },
  { schema: orderGetByIdSchema }
);

export const listOrdersAction = withAction<OrderListInput, OrderListResponse>(
  'orders.list',
  async (auth, input) => {
    const result = await OrderService.list({
      ...input,
      companyId: auth.companyId,
    });
    if (!result.isOk) return result;

    return Result.ok(result.data, 'Orders loaded');
  },
  { schema: orderListSchema }
);
