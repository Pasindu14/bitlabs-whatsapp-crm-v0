import { UsersTable } from "@/features/users/components/users-table";

export default function UsersPage() {
  return (
    <div className="px-10 py-6">
      <div className="mb-6 space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">
          Invite, edit, and deactivate users for your company. All changes are scoped to your tenant.
        </p>
      </div>
      <UsersTable />
    </div>
  );
}
