import { AccountAnalyticsTable } from "@/features/analytics/components/account-analytics-table";

export default function AnalyticsPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">
          View message volume analytics per WhatsApp account
        </p>
      </div>
      <AccountAnalyticsTable />
    </div>
  );
}
