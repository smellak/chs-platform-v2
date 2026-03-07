"use client";

import { usePathname } from "next/navigation";
import { t } from "@/i18n";

interface AgentSuggestionsProps {
  onSelect: (suggestion: string) => void;
  isSuperAdmin?: boolean;
}

const SUGGESTIONS: Record<string, string[]> = {
  "/": [
    "¿Qué servicios están funcionando?",
    "Resumen del estado de la plataforma",
    "¿Cuántos usuarios activos hay?",
  ],
  "/monitor": [
    "¿Cuánto hemos gastado en API esta semana?",
    "Servicios con mayor latencia",
    "Actividad reciente de la plataforma",
  ],
  "/admin/users": [
    "Lista de usuarios del departamento de Logística",
    "¿Quién no ha accedido en más de 30 días?",
    "Usuarios con rol de administrador",
  ],
  "/admin/apps": [
    "¿Qué departamentos tienen acceso a Citas?",
    "Apps en mantenimiento",
  ],
  "/profile": [
    "Mis últimas acciones",
    "Mis notificaciones no leídas",
  ],
};

const DEFAULT_SUGGESTIONS = [
  "¿Qué servicios están funcionando?",
  "¿Cuáles son mis aplicaciones disponibles?",
  "Mis notificaciones pendientes",
];

export function AgentSuggestions({ onSelect, isSuperAdmin }: AgentSuggestionsProps) {
  const pathname = usePathname();
  const i18n = t();

  const pageSuggestions = SUGGESTIONS[pathname] ?? [];
  const allSuggestions = pageSuggestions.length > 0
    ? pageSuggestions
    : DEFAULT_SUGGESTIONS;

  const suggestions = isSuperAdmin
    ? [...allSuggestions, "Ver actividad reciente de la plataforma"]
    : allSuggestions;

  return (
    <div className="space-y-2" data-testid="agent-suggestions">
      <p className="text-xs text-muted-foreground">{i18n.common.loading === "Cargando..." ? "Sugerencias" : "Suggestions"}</p>
      <div className="flex flex-wrap gap-2">
        {suggestions.slice(0, 4).map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => onSelect(suggestion)}
            className="text-xs px-3 py-1.5 rounded-full border border-border bg-muted/50 hover:bg-muted text-foreground transition-colors"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
