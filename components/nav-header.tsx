import { Command } from "lucide-react";
import { useSidebar } from "./ui/sidebar";

export function NavHeader() {
  const { state } = useSidebar();
  return (
    <div className="flex items-center gap-2 justify-center h-full">
      {/* Lucide icon added as logo */}
      <Command className="w-4" />
      {state === "expanded" && (
        <span className="font-semibold text-primary tracking-tight">
          Bitlabs Whatsapp CRM
        </span>
      )}
    </div>
  );
}
