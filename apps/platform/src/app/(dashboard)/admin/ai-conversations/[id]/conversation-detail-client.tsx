"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  Bot,
  Wrench,
  Clock,
  Zap,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/utils";

interface ToolCallRecord {
  id: string;
  capability: string;
  parameters: Record<string, unknown>;
  response: Record<string, unknown> | null;
  status: string | null;
  errorMessage: string | null;
  durationMs: number | null;
  appName: string | null;
}

interface MessageRow {
  id: string;
  role: string;
  content: string;
  toolCalls: Array<{ toolName: string; args: Record<string, unknown> }>;
  tokensUsed: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  model: string | null;
  latencyMs: number | null;
  createdAt: string;
  toolCallRecords: ToolCallRecord[];
}

interface ConversationInfo {
  id: string;
  title: string;
  userName: string;
  userEmail: string;
  createdAt: string;
}

interface ConversationDetailClientProps {
  conversation: ConversationInfo;
  messages: MessageRow[];
}

function ToolCallCard({ tc }: { tc: ToolCallRecord }) {
  const [expanded, setExpanded] = useState(false);
  const isError = tc.status === "error";

  return (
    <div className={`border rounded-lg p-3 text-sm ${isError ? "border-destructive/50 bg-destructive/5" : "border-border bg-muted/30"}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="h-3 w-3 text-muted-foreground" />
          <span className="font-medium">{tc.capability}</span>
          {tc.appName && (
            <Badge variant="outline" className="text-xs">{tc.appName}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {tc.durationMs !== null && (
            <span className="text-xs text-muted-foreground">{tc.durationMs}ms</span>
          )}
          {isError ? (
            <AlertCircle className="h-3 w-3 text-destructive" />
          ) : (
            <CheckCircle className="h-3 w-3 text-emerald-500" />
          )}
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        </div>
      </div>
      {expanded && (
        <div className="mt-2 space-y-2">
          <div>
            <span className="text-xs font-medium text-muted-foreground">Parámetros:</span>
            <pre className="mt-1 text-xs bg-muted rounded p-2 overflow-x-auto max-h-40">
              {JSON.stringify(tc.parameters, null, 2)}
            </pre>
          </div>
          {tc.response && (
            <div>
              <span className="text-xs font-medium text-muted-foreground">Respuesta:</span>
              <pre className="mt-1 text-xs bg-muted rounded p-2 overflow-x-auto max-h-40">
                {JSON.stringify(tc.response, null, 2)}
              </pre>
            </div>
          )}
          {tc.errorMessage && (
            <div>
              <span className="text-xs font-medium text-destructive">Error:</span>
              <p className="mt-1 text-xs text-destructive">{tc.errorMessage}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ConversationDetailClient({
  conversation,
  messages,
}: ConversationDetailClientProps) {
  const totalTokens = messages.reduce((sum, m) => sum + (m.tokensUsed ?? 0), 0);

  return (
    <div data-testid="conversation-detail-page">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/ai-conversations">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver
          </Button>
        </Link>
      </div>

      <div className="bg-card rounded-xl border border-border p-4 mb-6">
        <h1 className="text-xl font-bold mb-2">{conversation.title}</h1>
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span>{conversation.userName} ({conversation.userEmail})</span>
          <span>{formatRelativeTime(conversation.createdAt)}</span>
          <span>{messages.length} mensajes</span>
          <span>{totalTokens.toLocaleString()} tokens</span>
        </div>
      </div>

      <div className="space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`rounded-xl border p-4 ${
              msg.role === "user"
                ? "bg-primary/5 border-primary/20 ml-8"
                : "bg-card border-border mr-8"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {msg.role === "user" ? (
                  <User className="h-4 w-4 text-primary" />
                ) : (
                  <Bot className="h-4 w-4 text-emerald-500" />
                )}
                <span className="text-sm font-medium capitalize">{msg.role}</span>
                <span className="text-xs text-muted-foreground">
                  {formatRelativeTime(msg.createdAt)}
                </span>
              </div>
              {msg.role === "assistant" && (
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {msg.model && <Badge variant="secondary" className="text-xs">{msg.model}</Badge>}
                  {msg.tokensUsed !== null && (
                    <span className="flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      {msg.tokensUsed.toLocaleString()} tokens
                      {msg.inputTokens !== null && msg.outputTokens !== null && (
                        <span className="text-muted-foreground">
                          ({msg.inputTokens}↓ {msg.outputTokens}↑)
                        </span>
                      )}
                    </span>
                  )}
                  {msg.latencyMs !== null && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {msg.latencyMs}ms
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="text-sm whitespace-pre-wrap">{msg.content || "(sin contenido de texto)"}</div>

            {msg.toolCallRecords.length > 0 && (
              <div className="mt-3 space-y-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Tool calls ({msg.toolCallRecords.length}):
                </span>
                {msg.toolCallRecords.map((tc) => (
                  <ToolCallCard key={tc.id} tc={tc} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
