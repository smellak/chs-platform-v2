"use client";

import { useState, useEffect, useCallback } from "react";
import { AgentButton } from "./agent-button";
import { AgentPanel } from "./agent-panel";

interface AgentWrapperProps {
  userName: string;
  userInitials: string;
  isSuperAdmin: boolean;
}

export function AgentWrapper({ userName, userInitials, isSuperAdmin }: AgentWrapperProps) {
  const [open, setOpen] = useState(false);
  const [hasConversation, setHasConversation] = useState(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "j") {
      e.preventDefault();
      setOpen((prev) => !prev);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    async function checkConversations() {
      try {
        const res = await fetch("/api/agent/conversations");
        if (res.ok) {
          const data = (await res.json()) as { conversations: Array<{ id: string }> };
          setHasConversation((data.conversations?.length ?? 0) > 0);
        }
      } catch {
        // Non-critical check
      }
    }
    checkConversations();
  }, []);

  return (
    <>
      <AgentButton onClick={() => setOpen(true)} hasActiveConversation={hasConversation} />
      <AgentPanel
        open={open}
        onClose={() => setOpen(false)}
        userName={userName}
        userInitials={userInitials}
        isSuperAdmin={isSuperAdmin}
      />
    </>
  );
}
