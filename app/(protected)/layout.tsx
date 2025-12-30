import { auth } from "@/auth";
import { AppSidebar } from "@/components/app-sidebar";
import Breadcrumbs from "@/components/breadcrumbs";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

import { SessionProvider } from "next-auth/react";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/sign-in");
  }

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <SessionProvider session={session}>
        <main className="flex h-screen w-full overflow-hidden rounded-2xl border border-dashed">
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset className="flex flex-col flex-1 overflow-hidden">
              <header className="flex h-10 shrink-0 items-center gap-2 px-4 border-b">
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical" className="mr-2 h-10" />
                <Breadcrumbs />
              </header>

              <div className="flex-1 overflow-y-auto p-1 ">{children}</div>
            </SidebarInset>
          </SidebarProvider>
        </main>
      </SessionProvider>
    </div>
  );
}
