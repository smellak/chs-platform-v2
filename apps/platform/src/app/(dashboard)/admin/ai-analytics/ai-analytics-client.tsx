"use client";

import { Brain, MessageSquare, Coins, Zap, Wrench } from "lucide-react";
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

interface AIAnalyticsClientProps {
  stats: {
    totalConversations: number;
    totalMessages: number;
    totalTokens: number;
    totalCost: number;
  };
  messagesPerDay: Array<{ date: string; count: number }>;
  topTools: Array<{ capability: string; count: number }>;
  recentConversations: Array<{
    id: string;
    title: string;
    userName: string;
    messageCount: number;
    createdAt: string;
  }>;
}

export function AIAnalyticsClient({
  stats,
  messagesPerDay,
  topTools,
  recentConversations,
}: AIAnalyticsClientProps) {
  const maxMessages = Math.max(...messagesPerDay.map((d) => d.count), 1);

  const statCards = [
    {
      label: "Total Conversaciones",
      value: stats.totalConversations.toLocaleString(),
      icon: MessageSquare,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      label: "Total Mensajes",
      value: stats.totalMessages.toLocaleString(),
      icon: Zap,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
    },
    {
      label: "Tokens Utilizados",
      value: stats.totalTokens.toLocaleString(),
      icon: Brain,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      label: "Coste Total",
      value: `\u20AC${stats.totalCost.toFixed(2)}`,
      icon: Coins,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
  ];

  return (
    <div data-testid="ai-analytics-page">
      <div className="flex items-center gap-3 mb-6">
        <Brain className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Analíticas de IA</h1>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-card rounded-xl border border-border p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-muted-foreground">
                  {card.label}
                </span>
                <div className={`p-2 rounded-lg ${card.bgColor}`}>
                  <Icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </div>
              <p className="text-2xl font-bold">{card.value}</p>
            </div>
          );
        })}
      </div>

      {/* Messages per day */}
      <div className="bg-card rounded-xl border border-border p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Mensajes por día</h2>
        {messagesPerDay.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay datos de los últimos 7 días
          </p>
        ) : (
          <div className="flex items-end gap-2 h-40">
            {messagesPerDay.map((day) => {
              const heightPercent = (day.count / maxMessages) * 100;
              return (
                <div
                  key={day.date}
                  className="flex-1 flex flex-col items-center gap-1"
                >
                  <span className="text-xs font-medium text-muted-foreground">
                    {day.count}
                  </span>
                  <div
                    className="w-full bg-primary/80 rounded-t-md transition-all"
                    style={{ height: `${heightPercent}%`, minHeight: "4px" }}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {day.date.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top tools */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Wrench className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">
              Herramientas más usadas
            </h2>
          </div>
          {topTools.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay datos de herramientas
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Herramienta</TableHead>
                  <TableHead className="text-right">Usos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topTools.map((tool) => (
                  <TableRow key={tool.capability}>
                    <TableCell>
                      <Badge variant="secondary">{tool.capability}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {tool.count.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Recent conversations */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Conversaciones recientes</h2>
          </div>
          {recentConversations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay conversaciones
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead className="text-right">Msgs</TableHead>
                  <TableHead className="hidden sm:table-cell">Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentConversations.map((conv) => (
                  <TableRow key={conv.id}>
                    <TableCell className="font-medium max-w-32 truncate">
                      {conv.title}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {conv.userName}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {conv.messageCount}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                      {formatRelativeTime(conv.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}
