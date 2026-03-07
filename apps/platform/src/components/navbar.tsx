"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  LayoutDashboard,
  Activity,
  Settings,
  Sun,
  Moon,
  LogOut,
  User,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";
import Image from "next/image";
import type { AuthUser } from "@/lib/types";
import { NotificationBell } from "@/components/notification-bell";

interface NavbarProps {
  user: AuthUser;
  orgName?: string;
}

export function Navbar({ user, orgName }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/monitor", label: "Monitor", icon: Activity },
    ...(user.isSuperAdmin
      ? [{ href: "/admin", label: "Admin", icon: Settings }]
      : []),
  ];

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function getInitials(): string {
    return `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();
  }

  return (
    <nav className="hero-gradient text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Image src="/icon.svg" alt="" width={32} height={32} className="w-8 h-8" />
              <div className="hidden sm:block">
                <div className="text-sm font-bold tracking-wider">ALEPH</div>
                <div className="text-[10px] text-blue-200/70 tracking-widest uppercase">
                  {orgName ?? "Portal Corporativo"}
                </div>
              </div>
            </div>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? "bg-white/15 text-white"
                      : "text-blue-100/80 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-1">
            {/* Cmd+K hint */}
            <button
              onClick={() =>
                document.dispatchEvent(
                  new KeyboardEvent("keydown", {
                    key: "k",
                    metaKey: true,
                  }),
                )
              }
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-blue-200/60 hover:bg-white/10 transition-colors"
            >
              <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono">
                ⌘K
              </kbd>
            </button>

            {/* Notifications */}
            <NotificationBell />

            {/* Theme toggle */}
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>

            {/* User dropdown */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-xs font-medium">
                  {getInitials()}
                </div>
                <span className="hidden sm:block text-sm">
                  {user.firstName}
                </span>
                <ChevronDown className="h-3 w-3" />
              </button>

              {userMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 w-56 z-50 bg-card text-card-foreground rounded-xl shadow-lg border border-border py-1 overflow-hidden">
                    <div className="px-4 py-3 border-b border-border">
                      <p className="text-sm font-medium">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {user.email}
                      </p>
                      {user.departments[0] && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {user.departments[0].roleName} &middot;{" "}
                          {user.departments[0].departmentName}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        router.push("/profile");
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-accent transition-colors"
                    >
                      <User className="h-4 w-4" />
                      Mi perfil
                    </button>
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-accent transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      Cerrar sesión
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              {menuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile nav */}
      {menuOpen && (
        <div className="md:hidden border-t border-white/10 px-4 py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <button
                key={item.href}
                onClick={() => {
                  router.push(item.href);
                  setMenuOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-white/15 text-white"
                    : "text-blue-100/80 hover:bg-white/10"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </nav>
  );
}
