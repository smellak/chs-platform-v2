"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
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
import { DynamicIcon } from "@/components/dynamic-icon";
import {
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from "@/lib/actions/departments";
import { slugify } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

interface DeptRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  isActive: boolean;
  usersCount: number;
  appsCount: number;
}

interface DepartmentsClientProps {
  departments: DeptRow[];
}

export function DepartmentsClient({ departments }: DepartmentsClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DeptRow | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  function openCreate() {
    setEditing(null);
    setName("");
    setSlug("");
    setDialogOpen(true);
  }

  function openEdit(d: DeptRow) {
    setEditing(d);
    setName(d.name);
    setSlug(d.slug);
    setDialogOpen(true);
  }

  async function handleSubmit(formData: FormData) {
    const result = editing
      ? await updateDepartment(formData)
      : await createDepartment(formData);

    if (result.success) {
      toast({
        title: editing
          ? "Departamento actualizado"
          : "Departamento creado exitosamente",
      });
      setDialogOpen(false);
      router.refresh();
    } else {
      toast({ title: result.error ?? "Error", variant: "destructive" });
    }
  }

  async function handleDelete(id: string) {
    const result = await deleteDepartment(id);
    if (result.success) {
      toast({ title: "Departamento eliminado" });
      router.refresh();
    } else {
      toast({ title: result.error ?? "Error", variant: "destructive" });
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Gestión de Departamentos</h1>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Departamento
        </Button>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Departamento</TableHead>
              <TableHead className="hidden sm:table-cell">Slug</TableHead>
              <TableHead className="text-center">Usuarios</TableHead>
              <TableHead className="text-center">Apps</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {departments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No hay departamentos
                </TableCell>
              </TableRow>
            ) : (
              departments.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{
                          background: d.color
                            ? `linear-gradient(135deg, ${d.color}40, ${d.color}20)`
                            : "hsl(var(--muted))",
                        }}
                      >
                        {d.icon && (
                          <DynamicIcon
                            name={d.icon}
                            className="h-4 w-4"
                            style={{ color: d.color ?? undefined }}
                          />
                        )}
                      </div>
                      <div>
                        <div className="font-medium">{d.name}</div>
                        {d.description && (
                          <div className="text-xs text-muted-foreground line-clamp-1">
                            {d.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                    {d.slug}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{d.usersCount}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{d.appsCount}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(d)}>
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(d.id)}
                        disabled={d.usersCount > 0 || d.appsCount > 0}
                        title={
                          d.usersCount > 0 || d.appsCount > 0
                            ? "No se puede eliminar: tiene usuarios o apps"
                            : "Eliminar"
                        }
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
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
              {editing ? "Editar Departamento" : "Nuevo Departamento"}
            </DialogTitle>
          </DialogHeader>
          <form action={handleSubmit} className="space-y-4">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div>
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
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
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                name="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="description">Descripción</Label>
              <Input
                id="description"
                name="description"
                defaultValue={editing?.description ?? ""}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="icon">Icono</Label>
                <Input
                  id="icon"
                  name="icon"
                  placeholder="Building2"
                  defaultValue={editing?.icon ?? ""}
                />
              </div>
              <div>
                <Label htmlFor="color">Color</Label>
                <Input
                  id="color"
                  name="color"
                  type="color"
                  defaultValue={editing?.color ?? "#3B82F6"}
                />
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
                {editing ? "Guardar Cambios" : "Crear Departamento"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
