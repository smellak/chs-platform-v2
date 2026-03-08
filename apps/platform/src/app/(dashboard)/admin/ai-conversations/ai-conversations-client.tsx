"use client";

import { useState } from "react";
import Link from "next/link";
import { MessagesSquare, Search, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatRelativeTime } from "@/lib/utils";

interface ConversationRow {
  id: string;
  title: string;
  userName: string;
  userEmail: string;
  messageCount: number;
  totalTokens: number;
  lastModel: string;
  createdAt: string;
  updatedAt: string;
}

interface AiConversationsClientProps {
  conversations: ConversationRow[];
}

export function AiConversationsClient({ conversations }: AiConversationsClientProps) {
  const [search, setSearch] = useState("");

  const filtered = conversations.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.title.toLowerCase().includes(q) ||
      c.userName.toLowerCase().includes(q) ||
      c.userEmail.toLowerCase().includes(q)
    );
  });

  return (
    <div data-testid="ai-conversations-page">
      <div className="flex items-center gap-3 mb-6">
        <MessagesSquare className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Conversaciones IA</h1>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, usuario..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <span className="text-sm text-muted-foreground">
          {filtered.length} conversaciones
        </span>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead className="hidden sm:table-cell text-right">Mensajes</TableHead>
              <TableHead className="hidden md:table-cell text-right">Tokens</TableHead>
              <TableHead className="hidden lg:table-cell">Modelo</TableHead>
              <TableHead className="hidden sm:table-cell">Fecha</TableHead>
              <TableHead className="text-right">Ver</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No hay conversaciones
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium max-w-48 truncate">
                    {c.title}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="text-sm">{c.userName}</div>
                      <div className="text-xs text-muted-foreground">{c.userEmail}</div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-right text-sm">
                    {c.messageCount}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-right text-sm">
                    {c.totalTokens.toLocaleString()}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <Badge variant="secondary" className="text-xs">{c.lastModel}</Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                    {formatRelativeTime(c.updatedAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/admin/ai-conversations/${c.id}`}
                      className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Detalle
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
