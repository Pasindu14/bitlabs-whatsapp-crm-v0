import { OrdersTable } from "@/features/orders/components/orders-table";

export default function OrdersPage() {
  return (
    <div className="px-10 py-6">
      <div className="mb-6 space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Orders</h1>
        <p className="text-sm text-muted-foreground">
          Manage and track customer orders across your tenant.
        </p>
      </div>
      <OrdersTable />
    </div>
  );
}
