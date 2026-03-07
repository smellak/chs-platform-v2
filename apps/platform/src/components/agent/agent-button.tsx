"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AgentButtonProps {
  onClick: () => void;
  hasActiveConversation?: boolean;
}

export function AgentButton({ onClick, hasActiveConversation }: AgentButtonProps) {
  return (
    <Button
      onClick={onClick}
      size="icon"
      aria-label="Agente Aleph"
      data-testid="agent-button"
      className="fixed bottom-6 right-6 z-[900] h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-all duration-200"
      style={{
        background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
        border: "1px solid rgba(255,255,255,0.15)",
      }}
    >
      <Sparkles className="h-5 w-5 text-white" />
      {hasActiveConversation && (
        <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 border-2 border-white dark:border-gray-900" />
      )}
    </Button>
  );
}
