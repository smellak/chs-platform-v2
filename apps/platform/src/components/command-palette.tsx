"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  LayoutDashboard,
  Activity,
  Settings,
  Users,
  Building2,
  AppWindow,
  Shield,
  ScrollText,
  Cpu,
  User,
  Sun,
  Moon,
  Sparkles,
  Search,
} from "lucide-react";
import { Command } from "cmdk";

interface SearchResult {
  type: "user" | "app" | "department";
  id: string;
  name: string;
  detail: string;
}

interface CommandPaletteProps {
  isSuperAdmin: boolean;
}

const searchResultRoutes: Record<SearchResult["type"], string> = {
  user: "/admin/users",
  app: "/admin/apps",
  department: "/admin/departments",
};

const searchResultIcons: Record<SearchResult["type"], typeof Users> = {
  user: Users,
  app: AppWindow,
  department: Building2,
};

export function CommandPalette({ isSuperAdmin }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setOpen((prev) => !prev);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setSearchResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery.trim())}`);
        if (response.ok) {
          const data: { results: SearchResult[] } = await response.json();
          setSearchResults(data.results);
        }
      } catch {
        setSearchResults([]);
      }
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery]);

  function navigate(path: string) {
    router.push(path);
    setOpen(false);
  }

  function toggleTheme() {
    setTheme(theme === "dark" ? "light" : "dark");
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg">
        <Command
          className="bg-popover text-popover-foreground rounded-xl border border-border shadow-2xl overflow-hidden"
          onValueChange={() => {}}
        >
          <Command.Input
            placeholder="Buscar acciones, apps, páginas..."
            className="w-full px-4 py-3 text-sm bg-transparent border-b border-border outline-none placeholder:text-muted-foreground"
            autoFocus
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <Command.List className="max-h-72 overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              Sin resultados
            </Command.Empty>

            <Command.Group
              heading="Navegación"
              className="text-xs text-muted-foreground px-2 py-1.5"
            >
              <Command.Item
                onSelect={() => navigate("/")}
                className="flex items-center gap-2 px-2 py-2 rounded-lg text-sm cursor-pointer data-[selected=true]:bg-accent"
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Command.Item>
              <Command.Item
                onSelect={() => navigate("/monitor")}
                className="flex items-center gap-2 px-2 py-2 rounded-lg text-sm cursor-pointer data-[selected=true]:bg-accent"
              >
                <Activity className="h-4 w-4" />
                Monitor
              </Command.Item>
              <Command.Item
                onSelect={() => navigate("/profile")}
                className="flex items-center gap-2 px-2 py-2 rounded-lg text-sm cursor-pointer data-[selected=true]:bg-accent"
              >
                <User className="h-4 w-4" />
                Mi perfil
              </Command.Item>
            </Command.Group>

            {isSuperAdmin && (
              <Command.Group
                heading="Administración"
                className="text-xs text-muted-foreground px-2 py-1.5"
              >
                <Command.Item
                  onSelect={() => navigate("/admin/users")}
                  className="flex items-center gap-2 px-2 py-2 rounded-lg text-sm cursor-pointer data-[selected=true]:bg-accent"
                >
                  <Users className="h-4 w-4" />
                  Usuarios
                </Command.Item>
                <Command.Item
                  onSelect={() => navigate("/admin/departments")}
                  className="flex items-center gap-2 px-2 py-2 rounded-lg text-sm cursor-pointer data-[selected=true]:bg-accent"
                >
                  <Building2 className="h-4 w-4" />
                  Departamentos
                </Command.Item>
                <Command.Item
                  onSelect={() => navigate("/admin/apps")}
                  className="flex items-center gap-2 px-2 py-2 rounded-lg text-sm cursor-pointer data-[selected=true]:bg-accent"
                >
                  <AppWindow className="h-4 w-4" />
                  Aplicaciones
                </Command.Item>
                <Command.Item
                  onSelect={() => navigate("/admin/roles")}
                  className="flex items-center gap-2 px-2 py-2 rounded-lg text-sm cursor-pointer data-[selected=true]:bg-accent"
                >
                  <Shield className="h-4 w-4" />
                  Roles
                </Command.Item>
                <Command.Item
                  onSelect={() => navigate("/admin/audit")}
                  className="flex items-center gap-2 px-2 py-2 rounded-lg text-sm cursor-pointer data-[selected=true]:bg-accent"
                >
                  <ScrollText className="h-4 w-4" />
                  Auditoría
                </Command.Item>
                <Command.Item
                  onSelect={() => navigate("/admin/api-providers")}
                  className="flex items-center gap-2 px-2 py-2 rounded-lg text-sm cursor-pointer data-[selected=true]:bg-accent"
                >
                  <Cpu className="h-4 w-4" />
                  Proveedores API
                </Command.Item>
              </Command.Group>
            )}

            <Command.Group
              heading="Acciones"
              className="text-xs text-muted-foreground px-2 py-1.5"
            >
              <Command.Item
                onSelect={() => {
                  setOpen(false);
                  document.dispatchEvent(new KeyboardEvent("keydown", { key: "j", ctrlKey: true }));
                }}
                className="flex items-center gap-2 px-2 py-2 rounded-lg text-sm cursor-pointer data-[selected=true]:bg-accent"
              >
                <Sparkles className="h-4 w-4" />
                Preguntar al agente (⌘J)
              </Command.Item>
              <Command.Item
                onSelect={toggleTheme}
                className="flex items-center gap-2 px-2 py-2 rounded-lg text-sm cursor-pointer data-[selected=true]:bg-accent"
              >
                {theme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
                {theme === "dark" ? "Modo claro" : "Modo oscuro"}
              </Command.Item>
            </Command.Group>

            {searchResults.length > 0 && (
              <Command.Group
                heading="Resultados de búsqueda"
                className="text-xs text-muted-foreground px-2 py-1.5"
              >
                {searchResults.map((result) => {
                  const Icon = searchResultIcons[result.type];
                  return (
                    <Command.Item
                      key={`${result.type}-${result.id}`}
                      onSelect={() => navigate(searchResultRoutes[result.type])}
                      className="flex items-center gap-2 px-2 py-2 rounded-lg text-sm cursor-pointer data-[selected=true]:bg-accent"
                    >
                      <Icon className="h-4 w-4" />
                      <span>{result.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">{result.detail}</span>
                    </Command.Item>
                  );
                })}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
