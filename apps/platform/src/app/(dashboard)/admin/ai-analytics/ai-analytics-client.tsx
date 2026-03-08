"use client";

import { useRouter } from "next/navigation";
import {
  Brain,
  MessageSquare,
  Coins,
  Zap,
  Wrench,
  AlertTriangle,
  Download,
  CheckCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatRelativeTime } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

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
  modelStats: Array<{
    model: string;
    messageCount: number;
    totalTokens: number;
    avgLatency: number;
  }>;
  userStats: Array<{
    userName: string;
    messageCount: number;
    totalTokens: number;
    conversationCount: number;
  }>;
  alerts: Array<{
    id: string;
    severity: string;
    title: string;
    message: string;
    isResolved: boolean;
    createdAt: string;
  }>;
}

export function AIAnalyticsClient({
  stats,
  messagesPerDay,
  topTools,
  recentConversations,
  modelStats,
  userStats,
  alerts,
}: AIAnalyticsClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const maxMessages = Math.max(...messagesPerDay.map((d) => d.count), 1);
  const activeAlerts = alerts.filter((a) => !a.isResolved);

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

  async function handleExport(type: string) {
    try {
      const res = await fetch(`/api/admin/ai-export?type=${type}&format=csv`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type}-export.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Exportación descargada" });
    } catch {
      toast({ title: "Error al exportar", variant: "destructive" });
    }
  }

  async function handleResolveAlert(alertId: string) {
    try {
      const res = await fetch(`/api/admin/ai-export?action=resolve-alert&alertId=${alertId}`, {
        method: "POST",
      });
      if (res.ok) {
        toast({ title: "Alerta resuelta" });
        router.refresh();
      }
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  }

  return (
    <div data-testid="ai-analytics-page">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Brain className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Analíticas de IA</h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => handleExport("costs")}>
          <Download className="h-4 w-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-card rounded-xl border border-border p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-muted-foreground">{card.label}</span>
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
          <p className="text-sm text-muted-foreground">No hay datos de los últimos 7 días</p>
        ) : (
          <div className="flex items-end gap-2 h-40">
            {messagesPerDay.map((day) => {
              const heightPercent = (day.count / maxMessages) * 100;
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs font-medium text-muted-foreground">{day.count}</span>
                  <div
                    className="w-full bg-primary/80 rounded-t-md transition-all"
                    style={{ height: `${heightPercent}%`, minHeight: "4px" }}
                  />
                  <span className="text-[10px] text-muted-foreground">{day.date.slice(5)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Tabs defaultValue="summary">
        <TabsList className="mb-4">
          <TabsTrigger value="summary">Resumen</TabsTrigger>
          <TabsTrigger value="models">Por Modelo</TabsTrigger>
          <TabsTrigger value="users">Por Usuario</TabsTrigger>
          <TabsTrigger value="alerts">
            Alertas
            {activeAlerts.length > 0 && (
              <Badge variant="destructive" className="ml-2 text-xs">{activeAlerts.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Top tools */}
            <div className="bg-card rounded-xl border border-border p-6">
              <div className="flex items-center gap-2 mb-4">
                <Wrench className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Herramientas más usadas</h2>
              </div>
              {topTools.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay datos de herramientas</p>
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
                        <TableCell><Badge variant="secondary">{tool.capability}</Badge></TableCell>
                        <TableCell className="text-right font-medium">{tool.count.toLocaleString()}</TableCell>
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
                <p className="text-sm text-muted-foreground">No hay conversaciones</p>
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
                        <TableCell className="font-medium max-w-32 truncate">{conv.title}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{conv.userName}</TableCell>
                        <TableCell className="text-right text-sm">{conv.messageCount}</TableCell>
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
        </TabsContent>

        <TabsContent value="models">
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Uso por modelo</h2>
              <Button variant="outline" size="sm" onClick={() => handleExport("costs")}>
                <Download className="h-4 w-4 mr-2" />CSV
              </Button>
            </div>
            {modelStats.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay datos de modelos</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Modelo</TableHead>
                    <TableHead className="text-right">Mensajes</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Latencia prom.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modelStats.map((m) => (
                    <TableRow key={m.model}>
                      <TableCell><Badge variant="secondary">{m.model}</Badge></TableCell>
                      <TableCell className="text-right">{m.messageCount.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{m.totalTokens.toLocaleString()}</TableCell>
                      <TableCell className="text-right hidden sm:table-cell">{m.avgLatency}ms</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="users">
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-lg font-semibold mb-4">Uso por usuario</h2>
            {userStats.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay datos de usuarios</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead className="text-right">Conversaciones</TableHead>
                    <TableHead className="text-right">Mensajes</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userStats.map((u) => (
                    <TableRow key={u.userName}>
                      <TableCell className="font-medium">{u.userName}</TableCell>
                      <TableCell className="text-right">{u.conversationCount}</TableCell>
                      <TableCell className="text-right">{u.messageCount.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{u.totalTokens.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="alerts">
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <h2 className="text-lg font-semibold">Alertas</h2>
            </div>
            {alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay alertas</p>
            ) : (
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`border rounded-lg p-4 ${
                      alert.isResolved
                        ? "border-border bg-muted/30"
                        : alert.severity === "critical"
                          ? "border-destructive/50 bg-destructive/5"
                          : "border-amber-500/50 bg-amber-500/5"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            alert.isResolved
                              ? "secondary"
                              : alert.severity === "critical"
                                ? "destructive"
                                : "outline"
                          }
                        >
                          {alert.severity}
                        </Badge>
                        <span className="font-medium text-sm">{alert.title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(alert.createdAt)}
                        </span>
                        {!alert.isResolved && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleResolveAlert(alert.id)}
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Resolver
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
