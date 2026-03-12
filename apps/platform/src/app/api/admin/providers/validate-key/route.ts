import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

/**
 * POST /api/admin/providers/validate-key
 * Tests an API key by making a minimal call to the provider.
 * Body: { providerType: string, apiKey: string }
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user?.isSuperAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await req.json() as { providerType?: string; apiKey?: string };
  const { providerType, apiKey } = body;

  if (!providerType || !apiKey) {
    return NextResponse.json({ error: "providerType y apiKey requeridos" }, { status: 400 });
  }

  try {
    let valid = false;
    let detail = "";

    switch (providerType) {
      case "google": {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
          { signal: AbortSignal.timeout(10000) },
        );
        valid = res.ok;
        if (!valid) {
          const err = await res.json().catch(() => ({})) as Record<string, unknown>;
          detail = (err as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`;
        }
        break;
      }
      case "anthropic": {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 1,
            messages: [{ role: "user", content: "hi" }],
          }),
          signal: AbortSignal.timeout(15000),
        });
        // 200 = valid, 401 = invalid key, other errors may indicate valid key
        valid = res.status !== 401 && res.status !== 403;
        if (!valid) {
          detail = "API key inválida o sin permisos";
        }
        break;
      }
      case "openai": {
        const res = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(10000),
        });
        valid = res.ok;
        if (!valid) {
          detail = res.status === 401 ? "API key inválida" : `HTTP ${res.status}`;
        }
        break;
      }
      case "xai": {
        const res = await fetch("https://api.x.ai/v1/models", {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(10000),
        });
        valid = res.ok;
        if (!valid) {
          detail = res.status === 401 ? "API key inválida" : `HTTP ${res.status}`;
        }
        break;
      }
      default:
        return NextResponse.json({ error: `Proveedor no soportado: ${providerType}` }, { status: 400 });
    }

    return NextResponse.json({ valid, detail });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error de conexión";
    return NextResponse.json({ valid: false, detail: message });
  }
}
