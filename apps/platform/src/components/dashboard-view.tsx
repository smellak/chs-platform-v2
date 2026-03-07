"use client";

import { useState, useMemo } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Search,
  PackageOpen,
  ExternalLink,
} from "lucide-react";
import { DynamicIcon, getGradient } from "@/components/dynamic-icon";
import type { DepartmentWithApps, AppCard } from "@/lib/types";

function getStatusBadge(status: string, isMaintenance: boolean) {
  if (isMaintenance) {
    return {
      label: "Mantenimiento",
      dotColor: "#3b82f6",
      classes: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    };
  }
  switch (status) {
    case "online":
      return {
        label: "Operativo",
        dotColor: "#10b981",
        classes:
          "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
      };
    case "offline":
      return {
        label: "Fuera de línea",
        dotColor: "#ef4444",
        classes: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      };
    case "degraded":
      return {
        label: "Degradado",
        dotColor: "#f59e0b",
        classes:
          "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      };
    default:
      return {
        label: "Sin datos",
        dotColor: "#9E9E9E",
        classes:
          "bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400",
      };
  }
}

interface DashboardViewProps {
  departmentsWithApps: DepartmentWithApps[];
  userName: string;
  userDepartment: string;
  userRole: string;
  onlineCount: number;
  totalUniqueApps: number;
}

export function DashboardView({
  departmentsWithApps,
  userName,
  userDepartment,
  userRole,
  onlineCount,
  totalUniqueApps,
}: DashboardViewProps) {
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const selectedDept = departmentsWithApps.find(
    (d) => d.id === selectedDeptId,
  );

  const filteredDepartments = useMemo(() => {
    if (!search) return departmentsWithApps;
    return departmentsWithApps.filter((d) =>
      d.name.toLowerCase().includes(search.toLowerCase()),
    );
  }, [departmentsWithApps, search]);

  const filteredApps = useMemo(() => {
    if (!selectedDept) return [];
    if (!search) return selectedDept.apps;
    return selectedDept.apps.filter(
      (a) =>
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        (a.description ?? "").toLowerCase().includes(search.toLowerCase()),
    );
  }, [selectedDept, search]);

  const totalApps = useMemo(
    () => departmentsWithApps.reduce((acc, d) => acc + d.apps.length, 0),
    [departmentsWithApps],
  );

  const handleSelectDept = (id: string) => {
    setSelectedDeptId(id);
    setSearch("");
  };

  const handleBack = () => {
    setSelectedDeptId(null);
    setSearch("");
  };

  function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return "Buenos días";
    if (hour < 20) return "Buenas tardes";
    return "Buenas noches";
  }

  return (
    <div className="min-h-[calc(100vh-56px)]">
      {/* ===== HERO SECTION ===== */}
      <div
        className="relative overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, #0D47A1 0%, #1565C0 40%, #1976D2 70%, #1A237E 100%)",
        }}
      >
        <div className="absolute inset-0 dot-pattern" />

        {/* Decorative radials */}
        <div
          className="absolute top-[-50%] right-[-20%] w-[500px] h-[500px] rounded-full opacity-10"
          style={{
            background:
              "radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute bottom-[-30%] left-[-10%] w-[400px] h-[400px] rounded-full opacity-10"
          style={{
            background:
              "radial-gradient(circle, rgba(100,181,246,0.3) 0%, transparent 70%)",
          }}
        />

        <div className="relative z-10 max-w-7xl mx-auto px-6 pt-10 pb-16">
          {/* Top: Greeting + Stats */}
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="animate-fade-in-up">
              <div className="flex items-center gap-3 mb-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/chs-logo.png"
                  alt="CHS"
                  className="h-8 w-auto"
                  style={{
                    filter: "brightness(0) invert(1)",
                    opacity: 0.7,
                  }}
                />
                <div className="w-px h-6 bg-white/20" />
                <span className="text-white/50 text-sm font-medium tracking-wider uppercase">
                  Portal Corporativo
                </span>
              </div>
              <h1 className="text-3xl font-bold text-white mb-1">
                {getGreeting()}, {userName}
              </h1>
              <p className="text-white/60 text-sm">
                {userDepartment} &middot; {userRole}
              </p>
            </div>

            {/* Glass stat cards */}
            <div className="flex items-center gap-3 animate-fade-in-up stagger-2">
              <div className="glass-card rounded-md px-4 py-3 flex items-center gap-3">
                <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <div>
                  <p className="text-white/50 text-[10px] uppercase tracking-wider">
                    Servicios
                  </p>
                  <p className="text-white font-bold text-lg leading-tight">
                    {onlineCount}/{totalUniqueApps}
                  </p>
                </div>
              </div>
              <div className="glass-card rounded-md px-4 py-3 flex items-center gap-3">
                <svg className="h-4 w-4 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                <div>
                  <p className="text-white/50 text-[10px] uppercase tracking-wider">
                    Departamentos
                  </p>
                  <p className="text-white font-bold text-lg leading-tight">
                    {departmentsWithApps.length}
                  </p>
                </div>
              </div>
              <div className="glass-card rounded-md px-4 py-3 flex items-center gap-3">
                <svg className="h-4 w-4 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <div>
                  <p className="text-white/50 text-[10px] uppercase tracking-wider">
                    Apps
                  </p>
                  <p className="text-white font-bold text-lg leading-tight">
                    {totalUniqueApps}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Search bar + Back button — INSIDE hero */}
          <div className="mt-8 flex flex-wrap items-center gap-3 animate-fade-in-up stagger-3">
            {selectedDept && (
              <button
                onClick={handleBack}
                className="flex items-center gap-1.5 text-sm text-white/80 hover:text-white hover:bg-white/10 px-3 py-1.5 rounded-md transition-all"
              >
                <ArrowLeft className="h-4 w-4" />
                Departamentos
              </button>
            )}
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <input
                placeholder={
                  selectedDept
                    ? "Buscar aplicaciones..."
                    : "Buscar departamentos..."
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 h-10 rounded-md bg-white/10 border border-white/15 text-white text-sm placeholder:text-white/35 focus:outline-none focus:bg-white/15 focus:border-white/30 transition-all"
              />
            </div>
          </div>

          {/* Selected department header — INSIDE hero */}
          {selectedDept && (
            <div className="mt-5 flex items-center gap-3 animate-fade-in-up">
              <div className="h-9 w-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                <DynamicIcon
                  name={selectedDept.icon || "Building2"}
                  className="h-5 w-5 text-white/80"
                />
              </div>
              <h2 className="text-xl font-semibold text-white tracking-tight">
                {selectedDept.name}
              </h2>
              <span className="text-white/40 text-xs font-medium">
                {selectedDept.apps.length}{" "}
                {selectedDept.apps.length === 1 ? "app" : "apps"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ===== CONTENT — overlaps hero with -mt-6 ===== */}
      <div className="max-w-7xl mx-auto px-6 -mt-6 pb-10 relative z-20">
        {/* DEPARTMENTS GRID */}
        {!selectedDept ? (
          filteredDepartments.length === 0 ? (
            <div className="text-center py-20 bg-card rounded-md shadow-lg border border-border/50">
              {departmentsWithApps.length > 0 ? (
                <>
                  <Search className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground text-lg">
                    No se encontraron departamentos con ese término.
                  </p>
                </>
              ) : (
                <>
                  <PackageOpen className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground text-lg mb-2">
                    No tienes departamentos asignados todavía.
                  </p>
                  <p className="text-muted-foreground/70 text-sm">
                    Contacta con el departamento de IT si necesitas acceso.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredDepartments.map((dept, index) => {
                const gradient = getGradient(dept.color || "#607D8B");
                return (
                  <div
                    key={dept.id}
                    className={`app-card bg-card rounded-md border border-border/50 shadow-md cursor-pointer group animate-fade-in-up stagger-${Math.min(index + 1, 8)}`}
                    onClick={() => handleSelectDept(dept.id)}
                  >
                    <div className="p-6 flex flex-col items-center text-center">
                      <div
                        className="app-card-icon w-16 h-16 rounded-md flex items-center justify-center mb-4 shadow-lg"
                        style={{ background: gradient }}
                      >
                        <DynamicIcon
                          name={dept.icon || "Building2"}
                          className="h-8 w-8 text-white"
                        />
                      </div>
                      <h3 className="font-bold text-base mb-1 group-hover:text-[#1565C0] transition-colors">
                        {dept.name}
                      </h3>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-3 min-h-[32px]">
                        {dept.description}
                      </p>
                      <span className="text-[10px] text-muted-foreground bg-muted px-2.5 py-0.5 rounded-md font-semibold">
                        {dept.apps.length}{" "}
                        {dept.apps.length === 1
                          ? "aplicación"
                          : "aplicaciones"}
                      </span>
                      <div className="mt-4 flex items-center gap-1 text-xs font-medium text-[#1565C0] opacity-0 group-hover:opacity-100 transition-opacity">
                        <span>Ver aplicaciones</span>
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          /* ===== APPS GRID for selected department ===== */
          filteredApps.length === 0 ? (
            <div className="text-center py-20 bg-card rounded-md shadow-lg border border-border/50">
              <Search className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground text-lg">
                No se encontraron aplicaciones.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredApps.map((app, index) => (
                <AppCardItem key={app.id} app={app} index={index} />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

/* ===== APP CARD — CHS-style centered design ===== */
function AppCardItem({ app, index }: { app: AppCard; index: number }) {
  const badge = getStatusBadge(app.status, app.isMaintenance);
  const gradient = getGradient(app.color || "#607D8B");
  const appUrl = app.externalDomain
    ? `https://${app.externalDomain}`
    : null;

  return (
    <div
      className={`app-card bg-card rounded-md border border-border/50 shadow-md cursor-pointer group animate-fade-in-up stagger-${Math.min(index + 1, 8)}`}
      onClick={() => {
        if (appUrl) window.open(appUrl, "_blank");
      }}
    >
      <div className="p-6 flex flex-col items-center text-center">
        {/* Icon with gradient */}
        <div
          className="app-card-icon w-16 h-16 rounded-md flex items-center justify-center mb-4 shadow-lg"
          style={{ background: gradient }}
        >
          <DynamicIcon
            name={app.icon || "Box"}
            className="h-8 w-8 text-white"
          />
        </div>

        {/* Title */}
        <h3 className="font-bold text-base mb-1 group-hover:text-[#1565C0] transition-colors">
          {app.name}
        </h3>

        {/* Description */}
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3 min-h-[32px]">
          {app.description}
        </p>

        {/* Status indicator */}
        <div className="flex items-center gap-1.5 mb-3">
          <span
            className="h-2 w-2 rounded-full shrink-0 status-dot-pulse"
            style={{ backgroundColor: badge.dotColor }}
          />
          <span className="text-[11px] text-muted-foreground font-medium">
            {badge.label}
          </span>
        </div>

        {/* Version + Category badges */}
        <div className="flex items-center flex-wrap justify-center gap-1.5">
          {app.version && (
            <span className="text-[10px] text-muted-foreground bg-muted px-2.5 py-0.5 rounded-md font-semibold">
              v{app.version}
            </span>
          )}
          {app.category && (
            <span className="text-[10px] text-muted-foreground border border-border px-2.5 py-0.5 rounded-md font-medium">
              {app.category}
            </span>
          )}
        </div>

        {/* CTA — always visible "Abrir" link */}
        {appUrl ? (
          <a
            href={appUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#1565C0] hover:text-[#0D47A1] transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Abrir aplicación
          </a>
        ) : (
          <div className="mt-4 flex items-center gap-1 text-xs font-medium text-muted-foreground/50">
            <span>Solo acceso interno</span>
          </div>
        )}
      </div>
    </div>
  );
}
