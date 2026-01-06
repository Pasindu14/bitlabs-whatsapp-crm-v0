"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Building2, MessageCircle, User } from "lucide-react";

import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Separator } from "./ui/separator";
import { NavHeader } from "./nav-header";

const navMainData = [
  {
    title: "Conversations",
    url: "/conversations",
    icon: MessageCircle,
  },
  {
    title: "User Management",
    url: "/users",
    icon: User,
  },
  {
    title: "WhatsApp Account Management",
    url: "/whatsapp-accounts",
    icon: Building2,
  }
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const { data: session } = useSession();

  // Determine which section should be active based on current route
  const navMain = navMainData.map((item) => {
    const isActive = pathname === item.url || pathname?.startsWith(item.url + "/");
    return {
      ...item,
      isActive,
    };
  });

  const user = session?.user
    ? {
        name: session.user.name || "User",
        email: session.user.email || "",
        role: session.user.role || "User",
        avatar: "/avatars/default.jpg",
      }
    : {
        name: "User",
        email: "",
        role: "User",
        avatar: "/avatars/default.jpg",
      };

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <NavHeader />
      </SidebarHeader>
      <Separator />
      <SidebarContent>
        <NavMain items={navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
