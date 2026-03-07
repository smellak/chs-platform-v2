"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Search,
  PackageOpen,
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
}

export function DashboardView({ departmentsWithApps }: DashboardViewProps) {
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const selectedDept = departmentsWithApps.find(
    (d) => d.id === selectedDeptId,
  );

  // Filter departments or apps based on search
  const filteredDepartments = departmentsWithApps.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase()),
  );

  const filteredApps = selectedDept
    ? selectedDept.apps.filter(
        (a) =>
          a.name.toLowerCase().includes(search.toLowerCase()) ||
          (a.description ?? "").toLowerCase().includes(search.toLowerCase()),
      )
    : [];

  const handleSelectDept = (id: string) => {
    setSelectedDeptId(id);
    setSearch("");
  };

  const handleBack = () => {
    setSelectedDeptId(null);
    setSearch("");
  };

  return (
    <div className="max-w-7xl mx-auto px-6 -mt-6 pb-10 relative z-20">
      {/* Search bar inside hero (positioned via negative margin) */}
      <div className="mb-6 flex items-center gap-3">
        {selectedDept && (
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Departamentos
          </button>
        )}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            placeholder={
              selectedDept
                ? "Buscar aplicaciones..."
                : "Buscar departamentos..."
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-card border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-all"
          />
        </div>
      </div>

      {/* Department grid view */}
      {!selectedDept ? (
        filteredDepartments.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-md border border-border/50">
            <PackageOpen className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground text-lg">
              {departmentsWithApps.length > 0
                ? "No se encontraron departamentos con ese término."
                : "No tienes departamentos asignados todavía."}
            </p>
            {departmentsWithApps.length === 0 && (
              <p className="text-muted-foreground/70 text-sm mt-2">
                Contacta con el departamento de IT si necesitas acceso.
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredDepartments.map((dept, index) => {
              const gradient = getGradient(dept.color || "#607D8B");
              return (
                <div
                  key={dept.id}
                  className={`app-card bg-card rounded-md border border-border/50 cursor-pointer group animate-fade-in-up stagger-${Math.min(index + 1, 8)}`}
                  onClick={() => handleSelectDept(dept.id)}
                >
                  <div className="p-6 flex flex-col items-center text-center">
                    <div
                      className="app-card-icon w-16 h-16 rounded-md flex items-center justify-center mb-4 shadow-lg"
                      style={{ background: gradient }}
                    >
                      {dept.icon && (
                        <DynamicIcon
                          name={dept.icon}
                          className="h-8 w-8 text-white"
                        />
                      )}
                    </div>
                    <h3 className="font-bold text-base text-card-foreground group-hover:text-[#1565C0] transition-colors">
                      {dept.name}
                    </h3>
                    {dept.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {dept.description}
                      </p>
                    )}
                    <span className="mt-3 text-xs text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full font-medium">
                      {dept.apps.length} app
                      {dept.apps.length !== 1 ? "s" : ""}
                    </span>
                    <span className="mt-2 text-xs text-[#1565C0] font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      Ver aplicaciones
                      <ArrowUpRight className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* App cards for selected department */
        <div>
          <div className="flex items-center gap-3 mb-5 animate-fade-in-up">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shadow-lg"
              style={{
                background: getGradient(selectedDept.color || "#607D8B"),
              }}
            >
              {selectedDept.icon && (
                <DynamicIcon
                  name={selectedDept.icon}
                  className="h-5 w-5 text-white"
                />
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">
                {selectedDept.name}
              </h2>
              <p className="text-xs text-muted-foreground">
                {selectedDept.apps.length} aplicacion
                {selectedDept.apps.length !== 1 ? "es" : ""}
              </p>
            </div>
          </div>

          {filteredApps.length === 0 ? (
            <div className="text-center py-16 bg-card rounded-md border border-border/50">
              <Search className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">
                No se encontraron aplicaciones.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredApps.map((app, index) => (
                <AppCardItem
                  key={app.id}
                  app={app}
                  index={index}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AppCardItem({ app, index }: { app: AppCard; index: number }) {
  const badge = getStatusBadge(app.status, app.isMaintenance);
  const gradient = getGradient(app.color || "#607D8B");

  return (
    <div
      className={`app-card bg-card rounded-md border border-border/50 p-5 group animate-fade-in-up stagger-${Math.min(index + 1, 8)}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="app-card-icon w-12 h-12 rounded-lg flex items-center justify-center shadow-lg"
            style={{ background: gradient }}
          >
            {app.icon && (
              <DynamicIcon
                name={app.icon}
                className="h-6 w-6 text-white"
              />
            )}
          </div>
          <div>
            <h3 className="font-bold text-card-foreground group-hover:text-[#1565C0] transition-colors">
              {app.name}
            </h3>
            {app.category && (
              <p className="text-xs text-muted-foreground">{app.category}</p>
            )}
          </div>
        </div>

        {app.externalDomain && (
          <a
            href={`https://${app.externalDomain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg hover:bg-accent text-[#1565C0] opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1 text-xs font-medium"
          >
            Abrir
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {app.description && (
        <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
          {app.description}
        </p>
      )}

      <div className="flex items-center justify-between mt-4">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${badge.classes}`}
        >
          <span
            className="w-1.5 h-1.5 rounded-full status-dot-pulse"
            style={{ backgroundColor: badge.dotColor }}
          />
          {badge.label}
        </span>
        <div className="flex items-center gap-2">
          {app.version && (
            <span className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">
              v{app.version}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
