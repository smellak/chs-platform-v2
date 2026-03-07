import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { Navbar } from "@/components/navbar";
import { Toaster } from "@/components/ui/toaster";
import { CommandPalette } from "@/components/command-palette";
import { AgentWrapper } from "@/components/agent/agent-wrapper";
import { startHealthChecker } from "@/lib/health-checker";

// Start health checker once on server
const g = globalThis as unknown as Record<string, unknown>;
if (typeof g["__healthCheckerStarted"] === "undefined") {
  g["__healthCheckerStarted"] = true;
  startHealthChecker();
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch organization name from DB
  let orgName = "Centro Hogar Sánchez";
  try {
    const db = getDb();
    const [org] = await db.select({ name: schema.organizations.name }).from(schema.organizations).limit(1);
    if (org) orgName = org.name;
  } catch {
    // DB may not be ready yet during build
  }

  const userInitials = `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();
  const userName = `${user.firstName} ${user.lastName}`;

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} orgName={orgName} />
      <main>{children}</main>
      <Toaster />
      <CommandPalette isSuperAdmin={user.isSuperAdmin} />
      <AgentWrapper
        userName={userName}
        userInitials={userInitials}
        isSuperAdmin={user.isSuperAdmin}
      />
    </div>
  );
}
