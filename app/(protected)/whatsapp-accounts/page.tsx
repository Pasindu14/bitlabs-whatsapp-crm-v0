import { WhatsappAccountsTable } from "@/features/whatsapp-accounts/components/whatsapp-accounts-table";

export default function WhatsappAccountsPage() {
  return (
    <div className="px-10 py-6">

      <div className="mb-6 space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">
          WhatsApp Accounts
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage connected WhatsApp accounts, toggle their status, and configure defaults.
        </p>
      </div>
      <WhatsappAccountsTable />
    </div>
  );
}