"use client";

// Link not required here
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import React from "react";

function labelFromSegment(segment: string) {
  try {
    const decoded = decodeURIComponent(segment);
    return decoded
      .replace(/[-_]/g, " ")
      .split(" ")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" ");
  } catch {
    return segment;
  }
}

export function Breadcrumbs() {
  const pathname = usePathname() || "/";
  const segments = pathname.split("/").filter(Boolean);

  // Build cumulative hrefs for each segment
  const items: { href: string; label: string }[] = [
    { href: "/", label: "Home" },
    ...segments.map((seg, i) => ({
      href: `/${segments.slice(0, i + 1).join("/")}`,
      label: labelFromSegment(seg),
    })),
  ];

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {items.map((it, idx) => (
          <React.Fragment key={it.href}>
            <BreadcrumbItem>
              {idx === items.length - 1 ? (
                <BreadcrumbPage>{it.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink href={it.href}>{it.label}</BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {idx < items.length - 1 && (
              <BreadcrumbSeparator className="hidden md:block" />
            )}
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export default Breadcrumbs;
