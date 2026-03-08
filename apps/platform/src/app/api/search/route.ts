import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

interface SearchResult {
  type: "user" | "app" | "department";
  id: string;
  name: string;
  detail: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = request.headers.get("x-chs-user-id");
  if (!userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query || query.trim().length === 0) {
    return NextResponse.json({ results: [] });
  }

  const db = getDb();
  const pattern = `%${query}%`;

  const [users, apps, departments] = await Promise.all([
    db
      .select({
        id: schema.users.id,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        email: schema.users.email,
      })
      .from(schema.users)
      .where(
        sql`(${schema.users.firstName} || ' ' || ${schema.users.lastName}) ILIKE ${pattern} OR ${schema.users.email} ILIKE ${pattern}`,
      )
      .limit(5),

    db
      .select({
        id: schema.apps.id,
        name: schema.apps.name,
        category: schema.apps.category,
      })
      .from(schema.apps)
      .where(
        sql`${schema.apps.name} ILIKE ${pattern} OR ${schema.apps.slug} ILIKE ${pattern}`,
      )
      .limit(5),

    db
      .select({
        id: schema.departments.id,
        name: schema.departments.name,
      })
      .from(schema.departments)
      .where(sql`${schema.departments.name} ILIKE ${pattern}`)
      .limit(5),
  ]);

  const results: SearchResult[] = [
    ...users.map((u) => ({
      type: "user" as const,
      id: u.id,
      name: `${u.firstName} ${u.lastName}`,
      detail: u.email,
    })),
    ...apps.map((a) => ({
      type: "app" as const,
      id: a.id,
      name: a.name,
      detail: a.category ?? "Aplicación",
    })),
    ...departments.map((d) => ({
      type: "department" as const,
      id: d.id,
      name: d.name,
      detail: "Departamento",
    })),
  ];

  return NextResponse.json({ results });
}
