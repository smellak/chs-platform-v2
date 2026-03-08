import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CHS Platform — Documentación",
  description: "Documentación interna de CHS Platform",
};

const nav = [
  {
    title: "Getting Started",
    items: [
      { title: "Requisitos", href: "/getting-started/prerequisites" },
      { title: "Instalación", href: "/getting-started/installation" },
      { title: "Docker", href: "/getting-started/docker-setup" },
      { title: "Configuración", href: "/getting-started/configuration" },
      { title: "Primeros pasos", href: "/getting-started/first-login" },
    ],
  },
  {
    title: "Arquitectura",
    items: [
      { title: "Visión general", href: "/architecture/overview" },
      { title: "Monorepo", href: "/architecture/monorepo-structure" },
      { title: "Base de datos", href: "/architecture/database-schema" },
      { title: "Autenticación", href: "/architecture/authentication" },
      { title: "Sistema de agente", href: "/architecture/agent-system" },
      { title: "Protocolo headers", href: "/architecture/header-protocol" },
    ],
  },
  {
    title: "Guía de Admin",
    items: [
      { title: "Dashboard", href: "/admin-guide/dashboard" },
      { title: "Usuarios", href: "/admin-guide/users" },
      { title: "Departamentos", href: "/admin-guide/departments" },
      { title: "Roles", href: "/admin-guide/roles-permissions" },
      { title: "Apps", href: "/admin-guide/apps" },
      { title: "API Providers", href: "/admin-guide/api-providers" },
      { title: "API Keys", href: "/admin-guide/api-keys" },
      { title: "Webhooks", href: "/admin-guide/webhooks" },
      { title: "Monitoreo", href: "/admin-guide/monitoring" },
    ],
  },
  {
    title: "Guía Developer",
    items: [
      { title: "SDK Overview", href: "/developer-guide/sdk-overview" },
      { title: "Express", href: "/developer-guide/sdk-express" },
      { title: "Next.js", href: "/developer-guide/sdk-nextjs" },
      { title: "Agent SDK", href: "/developer-guide/agent-sdk" },
      { title: "Crear agentes", href: "/developer-guide/building-agents" },
      { title: "Registrar app", href: "/developer-guide/app-registration" },
    ],
  },
  {
    title: "API Reference",
    items: [
      { title: "Auth", href: "/api-reference/auth" },
      { title: "Admin", href: "/api-reference/admin" },
      { title: "Agent", href: "/api-reference/agent" },
      { title: "Monitor", href: "/api-reference/monitoring" },
      { title: "Search", href: "/api-reference/search" },
      { title: "Webhooks", href: "/api-reference/webhooks-api" },
    ],
  },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <div style={{ display: "flex", minHeight: "100vh" }}>
          <aside
            style={{
              width: "260px",
              borderRight: "1px solid #e2e8f0",
              padding: "1rem",
              overflowY: "auto",
              position: "sticky",
              top: 0,
              height: "100vh",
              flexShrink: 0,
            }}
          >
            <a href="/" style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem", textDecoration: "none", color: "#1e293b" }}>
              <span style={{ fontWeight: 800, fontSize: "1.2em" }}>CHS Docs</span>
            </a>
            {nav.map((section) => (
              <div key={section.title} style={{ marginBottom: "1rem" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", color: "#94a3b8", marginBottom: "0.25rem" }}>
                  {section.title}
                </div>
                {section.items.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    style={{ display: "block", padding: "0.25rem 0.5rem", fontSize: "0.875rem", color: "#475569", textDecoration: "none", borderRadius: "0.25rem" }}
                  >
                    {item.title}
                  </a>
                ))}
              </div>
            ))}
          </aside>
          <main style={{ flex: 1, padding: "2rem 3rem", maxWidth: "calc(100% - 260px)" }}>
            <article className="prose">{children}</article>
          </main>
        </div>
      </body>
    </html>
  );
}
