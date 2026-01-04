"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { ChevronRight, type LucideIcon } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";

interface NavItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  isActive?: boolean;
  items?: {
    title: string;
    url: string;
  }[];
}

function NavItemDirect({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const isActive =
    pathname === item.url || pathname?.startsWith(item.url + "/");

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        tooltip={item.title}
        isActive={isActive}
        className={
          isActive
            ? "transition-colors duration-200 data-[active=true]:bg-primary data-[active=true]:text-white"
            : "transition-colors duration-200"
        }
      >
        <a href={item.url}>
          {item.icon && <item.icon />}
          <span>{item.title}</span>
        </a>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function NavItemCollapsible({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(item.isActive ?? false);

  // Sync open state when isActive prop changes (e.g., route changes)
  React.useEffect(() => {
    setOpen(item.isActive ?? false);
  }, [item.isActive]);

  return (
    <Collapsible
      asChild
      open={open}
      onOpenChange={setOpen}
      className="group/collapsible"
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={item.title}>
            {item.icon && <item.icon />}
            <span>{item.title}</span>
            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.items?.map((subItem) => {
              // Check if this sub-item is active based on current pathname
              const isActive =
                pathname === subItem.url ||
                pathname?.startsWith(subItem.url + "/");

              return (
                <SidebarMenuSubItem key={subItem.title}>
                  <SidebarMenuSubButton
                    asChild
                    isActive={isActive}
                    className={
                      isActive
                        ? "transition-colors duration-200 data-[active=true]:bg-primary data-[active=true]:text-white"
                        : "transition-colors duration-200"
                    }
                  >
                    <a href={subItem.url}>
                      <span>{subItem.title}</span>
                    </a>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

export function NavMain({
  items,
}: {
  items: NavItem[];
}) {
  return (
    <SidebarGroup>
      <SidebarMenu>
        {items.map((item) =>
          item.items ? (
            <NavItemCollapsible key={item.title} item={item} />
          ) : (
            <NavItemDirect key={item.title} item={item} />
          )
        )}
      </SidebarMenu>
    </SidebarGroup>
  );
}
