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
    { href: "/", label: "MIS APPS", icon: LayoutDashboard },
    { href: "/monitor", label: "MONITOR", icon: Activity },
    ...(user.isSuperAdmin
      ? [{ href: "/admin", label: "ADMIN", icon: Settings }]
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
    <header
      className="h-14 flex items-center px-5 gap-4 sticky top-0 z-[999] border-b"
      style={{
        background: "linear-gradient(135deg, #0D47A1 0%, #1565C0 50%, #1976D2 100%)",
        borderColor: "rgba(255,255,255,0.1)",
      }}
    >
      {/* Logo section */}
      <div className="flex items-center gap-2 shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/chs-logo.png"
          alt="CHS Logo"
          className="h-7 w-auto"
          style={{ filter: "brightness(0) invert(1)", opacity: 0.9 }}
        />
        <span className="text-white/80 text-sm font-semibold hidden sm:inline tracking-wide">
          CHS
        </span>
      </div>

      <div className="w-px h-6 bg-white/15 shrink-0 hidden sm:block" />

      {/* Desktop nav */}
      <nav className="hidden md:flex flex-1 items-center justify-center gap-1">
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
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold tracking-wider transition-all ${
                isActive
                  ? "bg-white/20 text-white border border-white/10"
                  : "text-white/60 hover:bg-white/10 hover:text-white"
              }`}
              style={!isActive ? { background: "transparent", border: "none" } : undefined}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Right side */}
      <div className="flex items-center gap-1 ml-auto md:ml-0">
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
          className="hidden lg:flex items-center gap-1.5 h-7 px-2 rounded-md text-xs text-white/50 hover:bg-white/10 transition-colors"
          style={{
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <kbd className="text-[10px] font-mono">⌘K</kbd>
        </button>

        {/* Notifications */}
        <NotificationBell />

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="p-2 rounded-lg text-white/60 hover:bg-white/10 transition-colors"
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
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-medium text-white">
              {getInitials()}
            </div>
            <span className="hidden sm:block text-xs text-white font-medium">
              {user.firstName}
            </span>
            <ChevronDown className="h-3 w-3 text-white/60" />
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
          className="md:hidden p-2 rounded-lg hover:bg-white/10 transition-colors text-white"
        >
          {menuOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Mobile nav */}
      {menuOpen && (
        <div className="absolute left-0 right-0 top-14 bg-[#0D47A1] border-t border-white/10 px-4 py-2 md:hidden z-[998]">
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
                className={`w-full flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold tracking-wider transition-all ${
                  isActive
                    ? "bg-white/20 text-white"
                    : "text-white/60 hover:bg-white/10"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
}
