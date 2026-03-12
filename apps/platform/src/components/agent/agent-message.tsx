"use client";

import type { UIMessage } from "ai";
import { Sparkles, User, Wrench, AlertCircle } from "lucide-react";

interface AgentMessageProps {
  message: UIMessage;
  userInitials?: string;
}

function renderMarkdown(text: string): string {
  // Basic markdown: bold, italic, code, lists
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-xs">$1</code>')
    .replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4">$1. $2</li>')
    .replace(/\n/g, "<br />");
}

/** Extract concatenated text content from UIMessage parts */
function getTextContent(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

/** Check if a part is a tool-related part (dynamic-tool or tool-*) */
function isToolPart(
  part: UIMessage["parts"][number],
): part is UIMessage["parts"][number] & { toolCallId: string; state: string; toolName?: string } {
  return part.type === "dynamic-tool" || (part.type.startsWith("tool-") && part.type !== "text");
}

/** Get the tool name from a tool part (dynamic-tool has toolName, static tool-* encodes name in type) */
function getToolPartName(part: { type: string; toolName?: string }): string {
  if (part.type === "dynamic-tool" && part.toolName) return part.toolName;
  if (part.type.startsWith("tool-")) return part.type.slice(5); // "tool-buscar_usuarios" → "buscar_usuarios"
  return "unknown";
}

export function AgentMessage({ message, userInitials }: AgentMessageProps) {
  const isUser = message.role === "user";

  // Check for tool invocations in parts
  const toolInvocations = message.parts.filter(isToolPart);

  const textContent = getTextContent(message);

  return (
    <div className={`flex gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div
        className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-xs font-medium ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-gradient-to-br from-indigo-500 to-purple-600 text-white"
        }`}
      >
        {isUser ? (
          userInitials || <User className="h-3.5 w-3.5" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
      </div>

      {/* Message content */}
      <div className={`max-w-[80%] space-y-1 ${isUser ? "text-right" : "text-left"}`}>
        {/* Tool call indicators */}
        {toolInvocations.length > 0 && (
          <div className="space-y-1">
            {toolInvocations.map((ti, idx) => {
              const toolName = getToolPartName(ti);
              const isAppTool = toolName.includes("__");
              const displayName = isAppTool
                ? toolName.split("__")[1]?.replace(/_/g, " ")
                : toolName.replace(/_/g, " ");
              const state = ti.state;

              return (
                <div
                  key={`tool-${idx}`}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <Wrench className="h-3 w-3" />
                  <span>
                    {(state === "input-streaming" || state === "input-available") && `Ejecutando: ${displayName}...`}
                    {state === "output-available" && `${displayName}`}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Text content */}
        {textContent && (
          <div
            className={`inline-block px-3 py-2 rounded-lg text-sm ${
              isUser
                ? "bg-primary text-primary-foreground"
                : "bg-muted border border-border"
            }`}
          >
            {isUser ? (
              <p>{textContent}</p>
            ) : (
              <div
                className="prose prose-sm dark:prose-invert max-w-none [&_li]:list-disc"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(textContent) }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface AgentErrorMessageProps {
  error: string;
}

export function AgentErrorMessage({ error }: AgentErrorMessageProps) {
  return (
    <div className="flex gap-2">
      <div className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 bg-destructive/10">
        <AlertCircle className="h-3.5 w-3.5 text-destructive" />
      </div>
      <div className="inline-block px-3 py-2 rounded-lg text-sm bg-destructive/10 border border-destructive/20 text-destructive">
        {error}
      </div>
    </div>
  );
}
