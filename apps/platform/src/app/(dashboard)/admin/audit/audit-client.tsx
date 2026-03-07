"use client";

import { useState } from "react";
import { ScrollText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatRelativeTime } from "@/lib/utils";

interface AuditLog {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  userId: string | null;
  userName: string;
  userUsername: string | null;
}

interface AuditClientProps {
  logs: AuditLog[];
  actions: string[];
  users: { id: string; name: string }[];
}

const PAGE_SIZE = 20;

export function AuditClient({ logs, actions, users }: AuditClientProps) {
  const [filterAction, setFilterAction] = useState("all");
  const [filterUser, setFilterUser] = useState("all");
  const [page, setPage] = useState(0);

  const filtered = logs.filter((l) => {
    const matchesAction = filterAction === "all" || l.action === filterAction;
    const matchesUser = filterUser === "all" || l.userId === filterUser;
    return matchesAction && matchesUser;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function getActionBadge(action: string) {
    if (action.includes("create")) return "success" as const;
    if (action.includes("update")) return "warning" as const;
    if (action.includes("delete")) return "destructive" as const;
    if (action.includes("login")) return "default" as const;
    return "secondary" as const;
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <ScrollText className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Registro de Auditoría</h1>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <Select value={filterAction} onValueChange={(v) => { setFilterAction(v); setPage(0); }}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Acción" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las acciones</SelectItem>
            {actions.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterUser} onValueChange={(v) => { setFilterUser(v); setPage(0); }}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Usuario" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los usuarios</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Acción</TableHead>
              <TableHead className="hidden md:table-cell">Entidad</TableHead>
              <TableHead className="hidden lg:table-cell">Detalles</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No hay registros de auditoría
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {formatRelativeTime(log.createdAt)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {log.userName || log.userUsername || "Sistema"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getActionBadge(log.action)}>
                      {log.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {log.entityType ?? "—"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground max-w-48 truncate">
                    {log.details
                      ? Object.entries(log.details)
                          .map(([k, v]) => `${k}: ${String(v)}`)
                          .join(", ")
                      : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            {filtered.length} registros
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1 text-sm rounded-md border border-border disabled:opacity-50 hover:bg-accent"
            >
              Anterior
            </button>
            <span className="text-sm text-muted-foreground">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1 text-sm rounded-md border border-border disabled:opacity-50 hover:bg-accent"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
