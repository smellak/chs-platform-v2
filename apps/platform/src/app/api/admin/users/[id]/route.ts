import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const currentUser = await getCurrentUser();
  if (!currentUser?.isSuperAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;

  if (id === currentUser.id) {
    return NextResponse.json(
      { error: "No puedes eliminarte a ti mismo" },
      { status: 400 },
    );
  }

  const db = getDb();

  try {
    const users = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);
    const user = users[0];

    if (!user) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 },
      );
    }

    if (user.isSuperAdmin) {
      return NextResponse.json(
        { error: "No se puede eliminar al Super Admin" },
        { status: 403 },
      );
    }

    // Soft delete: mark as inactive
    await db
      .update(schema.users)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(schema.users.id, id));

    // Log activity
    const org = await db.select().from(schema.organizations).limit(1);
    if (org[0]) {
      await db.insert(schema.activityLogs).values({
        orgId: org[0].id,
        userId: currentUser.id,
        action: "user.delete",
        entityType: "user",
        entityId: id,
        details: {
          username: user.username,
          name: `${user.firstName} ${user.lastName}`,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
