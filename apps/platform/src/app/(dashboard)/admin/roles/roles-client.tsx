"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Shield, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { createRole, updateRole, deleteRole } from "@/lib/actions/roles";
import { slugify } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

interface RoleRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isSystem: boolean;
  permissions: Record<string, boolean> | null;
  usersCount: number;
}

interface RolesClientProps {
  roles: RoleRow[];
}

const PERMISSIONS = [
  { key: "apps.read", label: "Ver aplicaciones" },
  { key: "apps.write", label: "Gestionar aplicaciones" },
  { key: "users.read", label: "Ver usuarios" },
  { key: "users.write", label: "Gestionar usuarios" },
  { key: "departments.read", label: "Ver departamentos" },
  { key: "departments.write", label: "Gestionar departamentos" },
  { key: "audit.read", label: "Ver auditoría" },
  { key: "settings.write", label: "Gestionar configuración" },
];

export function RolesClient({ roles }: RolesClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RoleRow | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [perms, setPerms] = useState<Record<string, boolean>>({});

  function openCreate() {
    setEditing(null);
    setName("");
    setSlug("");
    setPerms({});
    setDialogOpen(true);
  }

  function openEdit(r: RoleRow) {
    setEditing(r);
    setName(r.name);
    setSlug(r.slug);
    setPerms(r.permissions ?? {});
    setDialogOpen(true);
  }

  function togglePerm(key: string) {
    setPerms((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleDelete(roleId: string) {
    if (!confirm("¿Seguro que deseas eliminar este rol?")) return;
    const result = await deleteRole(roleId);
    if (result.success) {
      toast({ title: "Rol eliminado" });
      router.refresh();
    } else {
      toast({ title: result.error ?? "Error al eliminar", variant: "destructive" });
    }
  }

  async function handleSubmit(formData: FormData) {
    formData.set("permissions", JSON.stringify(perms));

    const result = editing
      ? await updateRole(formData)
      : await createRole(formData);

    if (result.success) {
      toast({
        title: editing ? "Rol actualizado" : "Rol creado exitosamente",
      });
      setDialogOpen(false);
      router.refresh();
    } else {
      toast({ title: result.error ?? "Error", variant: "destructive" });
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Gestión de Roles</h1>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Rol
        </Button>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rol</TableHead>
              <TableHead className="hidden sm:table-cell">Slug</TableHead>
              <TableHead className="hidden md:table-cell">Tipo</TableHead>
              <TableHead className="text-center">Usuarios</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No hay roles
                </TableCell>
              </TableRow>
            ) : (
              roles.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Shield className="h-4 w-4 text-primary" />
                      <div>
                        <div className="font-medium">{r.name}</div>
                        {r.description && (
                          <div className="text-xs text-muted-foreground line-clamp-1">
                            {r.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                    {r.slug}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant={r.isSystem ? "default" : "secondary"}>
                      {r.isSystem ? "Sistema" : "Personalizado"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{r.usersCount}</Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(r)}
                    >
                      Editar
                    </Button>
                    {!r.isSystem && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(r.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar Rol" : "Nuevo Rol"}
            </DialogTitle>
          </DialogHeader>
          <form action={handleSubmit} className="space-y-4">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            {editing?.isSystem && (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Los roles de sistema no se pueden eliminar.
              </p>
            )}
            <div>
              <Label htmlFor="roleName">Nombre</Label>
              <Input
                id="roleName"
                name="name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!editing) setSlug(slugify(e.target.value));
                }}
                required
              />
            </div>
            <div>
              <Label htmlFor="roleSlug">Slug</Label>
              <Input
                id="roleSlug"
                name="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="roleDesc">Descripción</Label>
              <Input
                id="roleDesc"
                name="description"
                defaultValue={editing?.description ?? ""}
              />
            </div>
            <div>
              <Label>Permisos</Label>
              <div className="grid grid-cols-1 gap-2 mt-2">
                {PERMISSIONS.map((p) => (
                  <label
                    key={p.key}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={!!perms[p.key]}
                      onChange={() => togglePerm(p.key)}
                      className="rounded border-border"
                    />
                    {p.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit">
                {editing ? "Guardar Cambios" : "Crear Rol"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
