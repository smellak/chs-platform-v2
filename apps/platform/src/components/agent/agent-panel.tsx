"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { DefaultChatTransport } from "ai";
import { AnimatePresence, motion } from "framer-motion";
import { X, Plus, Sparkles, Send, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AgentMessage, AgentErrorMessage } from "./agent-message";
import { AgentSuggestions } from "./agent-suggestions";

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
}

interface AgentPanelProps {
  open: boolean;
  onClose: () => void;
  userName: string;
  userInitials: string;
  isSuperAdmin: boolean;
}

export function AgentPanel({ open, onClose, userName, userInitials, isSuperAdmin }: AgentPanelProps) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(false);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const conversationIdRef = useRef(conversationId);
  conversationIdRef.current = conversationId;

  const loadConversations = useCallback(async () => {
    setLoadingConvs(true);
    try {
      const res = await fetch("/api/agent/conversations");
      if (res.ok) {
        const data = (await res.json()) as { conversations: Conversation[] };
        setConversations(data.conversations ?? []);
      }
    } catch {
      // Silently fail - conversations list is not critical
    } finally {
      setLoadingConvs(false);
    }
  }, []);

  const transport = useRef(
    new DefaultChatTransport({
      api: "/api/agent/chat",
      body: () => ({ conversationId: conversationIdRef.current }),
      fetch: async (fetchInput, fetchInit) => {
        const response = await globalThis.fetch(fetchInput, fetchInit);
        const newConvId = response.headers.get("X-Conversation-Id");
        if (newConvId && !conversationIdRef.current) {
          setConversationId(newConvId);
        }
        return response;
      },
    }),
  ).current;

  const {
    messages,
    sendMessage,
    setMessages,
    status,
    error,
  } = useChat({
    transport,
    onFinish: () => {
      loadConversations();
    },
    onError: () => {
      // Error is handled via the error state
    },
  });

  useEffect(() => {
    if (open) {
      loadConversations();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, loadConversations]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleNewConversation = () => {
    setConversationId(null);
    setMessages([]);
    setInput("");
    inputRef.current?.focus();
  };

  const loadConversation = async (id: string) => {
    try {
      const res = await fetch(`/api/agent/conversations/${id}`);
      if (res.ok) {
        const data = (await res.json()) as { conversation: Conversation; messages: Array<{ role: string; content: string; id: string }> };
        setConversationId(data.conversation.id);
        setMessages(
          data.messages.map((m): UIMessage => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            parts: [{ type: "text", text: m.content }],
          })),
        );
      }
    } catch {
      // Ignore load errors
    }
  };

  const deleteConversation = async (id: string) => {
    try {
      await fetch(`/api/agent/conversations/${id}`, { method: "DELETE" });
      if (conversationId === id) {
        handleNewConversation();
      }
      await loadConversations();
    } catch {
      // Ignore delete errors
    }
  };

  const handleSuggestionSelect = (suggestion: string) => {
    setInput(suggestion);
    setTimeout(() => {
      sendMessage({ text: suggestion });
      setInput("");
    }, 50);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim()) return;
    sendMessage({ text: input });
    setInput("");
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim()) {
        handleSubmit();
      }
    }
  };

  const isLoading = status === "streaming" || status === "submitted";
  const showSuggestions = messages.length === 0 && !isLoading;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[950] bg-black/30"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            data-testid="agent-panel"
            className="fixed right-0 top-0 bottom-0 z-[960] w-full sm:w-[400px] bg-background border-l border-border flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b shrink-0">
              <div className="flex items-center gap-2">
                <div
                  className="h-8 w-8 rounded-lg flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #4F46E5, #7C3AED)" }}
                >
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">Agente Aleph</h2>
                  <p className="text-[10px] text-muted-foreground">Asistente inteligente</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNewConversation} title="Nueva conversación">
                  <Plus className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} title="Cerrar">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Recent conversations */}
            {showSuggestions && conversations.length > 0 && (
              <div className="border-b px-4 py-2 shrink-0">
                <p className="text-[10px] text-muted-foreground mb-1">Conversaciones recientes</p>
                <div className="flex flex-col gap-0.5 max-h-28 overflow-y-auto">
                  {conversations.slice(0, 5).map((conv) => (
                    <div key={conv.id} className="flex items-center gap-1">
                      <button
                        onClick={() => loadConversation(conv.id)}
                        className="flex-1 text-left text-xs truncate py-1 px-2 rounded hover:bg-muted transition-colors"
                      >
                        {conv.title}
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => deleteConversation(conv.id)}
                      >
                        <Trash2 className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Messages area */}
            <ScrollArea className="flex-1" ref={scrollRef}>
              <div className="flex flex-col gap-3 p-4">
                {showSuggestions && (
                  <div className="mt-4">
                    <div className="text-center mb-6">
                      <div
                        className="h-12 w-12 rounded-full flex items-center justify-center mx-auto mb-3"
                        style={{ background: "linear-gradient(135deg, #4F46E5, #7C3AED)" }}
                      >
                        <Sparkles className="h-6 w-6 text-white" />
                      </div>
                      <p className="text-sm font-medium">
                        Hola {userName.split(" ")[0]}, ¿en qué puedo ayudarte?
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Puedo consultar servicios, gestionar apps y mucho más
                      </p>
                    </div>
                    <AgentSuggestions
                      onSelect={handleSuggestionSelect}
                      isSuperAdmin={isSuperAdmin}
                    />
                  </div>
                )}

                {messages.map((msg) => (
                  <AgentMessage key={msg.id} message={msg} userInitials={userInitials} />
                ))}

                {error && (
                  <AgentErrorMessage error={error.message || "Error al procesar el mensaje"} />
                )}

                {isLoading && messages[messages.length - 1]?.role === "user" && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-xs">Pensando...</span>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Input area */}
            <div className="p-4 border-t shrink-0">
              <form onSubmit={handleSubmit} className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Escribe tu mensaje..."
                  disabled={isLoading}
                  data-testid="agent-input"
                  rows={1}
                  className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 max-h-24"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!input.trim() || isLoading}
                  className="shrink-0 h-9 w-9"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
