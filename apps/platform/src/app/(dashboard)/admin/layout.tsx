"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  Building2,
  AppWindow,
  Shield,
  ScrollText,
  Cpu,
  Key,
  Webhook,
  Brain,
} from "lucide-react";
import { cn } from "@/lib/utils";

const sidebarItems = [
  { href: "/admin/users", label: "Usuarios", icon: Users },
  { href: "/admin/departments", label: "Departamentos", icon: Building2 },
  { href: "/admin/apps", label: "Aplicaciones", icon: AppWindow },
  { href: "/admin/roles", label: "Roles", icon: Shield },
  { href: "/admin/audit", label: "Auditoría", icon: ScrollText },
  { href: "/admin/api-providers", label: "Proveedores API", icon: Cpu },
  { href: "/admin/api-keys", label: "Claves API", icon: Key },
  { href: "/admin/webhooks", label: "Webhooks", icon: Webhook },
  { href: "/admin/ai-analytics", label: "IA Analytics", icon: Brain },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar */}
        <nav className="md:w-56 shrink-0">
          <div className="bg-card rounded-xl border border-border p-2 md:sticky md:top-6">
            <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible">
              {sidebarItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
