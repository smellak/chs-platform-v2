"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MonitorDot, Trash2, Users, Clock, Wifi, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { revokeSession, revokeAllUserSessions } from "@/lib/actions/sessions";
import { useToast } from "@/components/ui/use-toast";

interface SessionRow {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userUsername: string;
  expiresAt: string;
  createdAt: string;
  lastAccessedAt: string | null;
  userAgent: string | null;
  ipAddress: string | null;
}

interface SessionsClientProps {
  sessions: SessionRow[];
  currentUserId: string;
  currentPage: number;
  totalPages: number;
  totalSessions: number;
}

function parseUserAgent(ua: string | null): string {
  if (!ua) return "Desconocido";
  if (ua.includes("Chrome") && !ua.includes("Edg")) return "Chrome";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
  if (ua.includes("Edg")) return "Edge";
  if (ua.includes("Playwright")) return "Playwright";
  return ua.substring(0, 30) + "...";
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Ahora";
  if (diffMin < 60) return `Hace ${diffMin}m`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `Hace ${diffHrs}h`;
  const diffDays = Math.floor(diffHrs / 24);
  return `Hace ${diffDays}d`;
}

function timeUntil(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  if (diffMs <= 0) return "Expirado";
  const diffHrs = Math.floor(diffMs / 3600000);
  if (diffHrs < 24) return `${diffHrs}h`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d`;
}

export function SessionsClient({
  sessions,
  currentUserId,
  currentPage,
  totalPages,
  totalSessions,
}: SessionsClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [revoking, setRevoking] = useState<string | null>(null);

  const uniqueUsers = new Set(sessions.map((s) => s.userId)).size;

  async function handleRevoke(sessionId: string) {
    if (!confirm("¿Revocar esta sesión?")) return;
    setRevoking(sessionId);
    const result = await revokeSession(sessionId);
    setRevoking(null);
    if (result.success) {
      toast({ title: "Sesión revocada" });
      router.refresh();
    } else {
      toast({ title: result.error ?? "Error", variant: "destructive" });
    }
  }

  async function handleRevokeAllUser(userId: string, userName: string) {
    if (!confirm(`¿Revocar todas las sesiones de ${userName}?`)) return;
    const result = await revokeAllUserSessions(userId);
    if (result.success) {
      toast({ title: `Sesiones de ${userName} revocadas` });
      router.refresh();
    } else {
      toast({ title: result.error ?? "Error", variant: "destructive" });
    }
  }

  function goToPage(page: number) {
    router.push(`/admin/sessions?page=${page}`);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Sesiones Activas</h1>
        <Badge variant="secondary" className="text-sm">
          <MonitorDot className="h-3 w-3 mr-1" />
          {totalSessions} sesiones
        </Badge>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Wifi className="h-4 w-4" />
            Total Sesiones
          </div>
          <div className="text-2xl font-bold">{totalSessions}</div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Users className="h-4 w-4" />
            Usuarios en Página
          </div>
          <div className="text-2xl font-bold">{uniqueUsers}</div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Clock className="h-4 w-4" />
            Página
          </div>
          <div className="text-2xl font-bold">{currentPage} / {totalPages}</div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead className="hidden sm:table-cell">IP</TableHead>
              <TableHead className="hidden md:table-cell">Navegador</TableHead>
              <TableHead className="hidden lg:table-cell">Creada</TableHead>
              <TableHead>Último Acceso</TableHead>
              <TableHead className="hidden sm:table-cell">Expira</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No hay sesiones activas
                </TableCell>
              </TableRow>
            ) : (
              sessions.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{s.userName}</div>
                      <div className="text-xs text-muted-foreground">
                        @{s.userUsername}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                    {s.ipAddress ?? "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {parseUserAgent(s.userAgent)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                    {new Date(s.createdAt).toLocaleDateString("es-ES", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {timeAgo(s.lastAccessedAt)}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge
                      variant={
                        new Date(s.expiresAt).getTime() - Date.now() <
                        24 * 3600000
                          ? "destructive"
                          : "secondary"
                      }
                      className="text-xs"
                    >
                      {timeUntil(s.expiresAt)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      disabled={revoking === s.id}
                      onClick={() => handleRevoke(s.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    {s.userId !== currentUserId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive text-xs"
                        onClick={() =>
                          handleRevokeAllUser(s.userId, s.userName)
                        }
                      >
                        Revocar Todo
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            {totalSessions} sesiones
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => goToPage(currentPage - 1)}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Anterior
            </Button>
            <span className="text-sm text-muted-foreground">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => goToPage(currentPage + 1)}
            >
              Siguiente
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
