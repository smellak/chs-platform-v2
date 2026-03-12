"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, UserCheck, UserX, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { createUser, updateUser, toggleUserActive, deleteUser } from "@/lib/actions/users";
import { formatRelativeTime, getInitials } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

interface UserRow {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  isSuperAdmin: boolean;
  lastLogin: string | null;
  createdAt: string;
  departmentRole: {
    departmentId: string;
    departmentName: string;
    roleId: string;
    roleName: string;
  } | null;
}

interface UsersClientProps {
  users: UserRow[];
  departments: { id: string; name: string }[];
  roles: { id: string; name: string }[];
}

export function UsersClient({ users, departments, roles }: UsersClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("all");
  const [filterStatus, setFilterStatus] = useState<"active" | "inactive" | "all">("active");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = users.filter((u) => {
    const matchesSearch =
      u.firstName.toLowerCase().includes(search.toLowerCase()) ||
      u.lastName.toLowerCase().includes(search.toLowerCase()) ||
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchesDept =
      filterDept === "all" || u.departmentRole?.departmentId === filterDept;
    const matchesStatus =
      filterStatus === "all" ||
      (filterStatus === "active" && u.isActive) ||
      (filterStatus === "inactive" && !u.isActive);
    return matchesSearch && matchesDept && matchesStatus;
  });

  const activeCount = users.filter((u) => u.isActive).length;
  const inactiveCount = users.filter((u) => !u.isActive).length;

  function openCreate() {
    setEditingUser(null);
    setDialogOpen(true);
  }

  function openEdit(u: UserRow) {
    setEditingUser(u);
    setDialogOpen(true);
  }

  async function handleSubmit(formData: FormData) {
    const result = editingUser
      ? await updateUser(formData)
      : await createUser(formData);

    if (result.success) {
      toast({
        title: editingUser ? "Usuario actualizado" : "Usuario creado exitosamente",
      });
      setDialogOpen(false);
      router.refresh();
    } else {
      toast({ title: result.error ?? "Error", variant: "destructive" });
    }
  }

  async function handleToggle(userId: string) {
    const result = await toggleUserActive(userId);
    if (result.success) {
      router.refresh();
    } else {
      toast({ title: result.error ?? "Error", variant: "destructive" });
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const result = await deleteUser(deleteTarget.id);
      if (result.success) {
        toast({
          title: "Usuario eliminado",
          description: `${deleteTarget.firstName} ${deleteTarget.lastName} ha sido desactivado y eliminado de la lista.`,
        });
        setDeleteTarget(null);
        router.refresh();
      } else {
        toast({ title: result.error ?? "Error al eliminar", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error al eliminar usuario", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div data-testid="users-page">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Gestión de Usuarios</h1>
        <Button onClick={openCreate} size="sm" data-testid="new-user-btn">
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Usuario
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar usuarios..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterDept} onValueChange={setFilterDept}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Departamento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los departamentos</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filterStatus}
          onValueChange={(v) => setFilterStatus(v as "active" | "inactive" | "all")}
        >
          <SelectTrigger className="w-full sm:w-44" data-testid="status-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Activos ({activeCount})</SelectItem>
            <SelectItem value="inactive">Inactivos ({inactiveCount})</SelectItem>
            <SelectItem value="all">Todos ({users.length})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead className="hidden md:table-cell">Departamento</TableHead>
              <TableHead className="hidden md:table-cell">Rol</TableHead>
              <TableHead className="hidden sm:table-cell">Estado</TableHead>
              <TableHead className="hidden lg:table-cell">Último acceso</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  {filterStatus === "active"
                    ? "No hay usuarios activos"
                    : filterStatus === "inactive"
                      ? "No hay usuarios inactivos"
                      : "No se encontraron usuarios"}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((u) => (
                <TableRow key={u.id} data-testid={`user-row-${u.username}`}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
                        {getInitials(u.firstName, u.lastName)}
                      </div>
                      <div>
                        <div className="font-medium">
                          {u.firstName} {u.lastName}
                        </div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {u.departmentRole?.departmentName ?? "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex items-center gap-1">
                      {u.departmentRole?.roleName ?? "—"}
                      {u.isSuperAdmin && (
                        <Badge variant="default" className="ml-1 text-[10px]">
                          Admin
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant={u.isActive ? "success" : "destructive"}>
                      {u.isActive ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                    {u.lastLogin ? formatRelativeTime(u.lastLogin) : "Nunca"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>
                        Editar
                      </Button>
                      {!u.isSuperAdmin && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggle(u.id)}
                            title={u.isActive ? "Desactivar" : "Activar"}
                          >
                            {u.isActive ? (
                              <UserX className="h-4 w-4 text-destructive" />
                            ) : (
                              <UserCheck className="h-4 w-4 text-emerald-500" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(u)}
                            title="Eliminar usuario"
                            data-testid={`delete-user-${u.username}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingUser ? "Editar Usuario" : "Nuevo Usuario"}
            </DialogTitle>
          </DialogHeader>
          <form action={handleSubmit} className="space-y-4">
            {editingUser && (
              <input type="hidden" name="id" value={editingUser.id} />
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">Nombre</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  defaultValue={editingUser?.firstName}
                  required
                />
              </div>
              <div>
                <Label htmlFor="lastName">Apellido</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  defaultValue={editingUser?.lastName}
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                defaultValue={editingUser?.username}
                required
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={editingUser?.email}
                required
              />
            </div>
            <div>
              <Label htmlFor="password">
                Contraseña{editingUser ? " (dejar vacío para no cambiar)" : ""}
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                required={!editingUser}
                minLength={8}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="departmentId">Departamento</Label>
                <Select
                  name="departmentId"
                  defaultValue={editingUser?.departmentRole?.departmentId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="roleId">Rol</Label>
                <Select
                  name="roleId"
                  defaultValue={editingUser?.departmentRole?.roleId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="isSuperAdmin"
                name="isSuperAdmin"
                defaultChecked={editingUser?.isSuperAdmin}
                value="true"
              />
              <Label htmlFor="isSuperAdmin">Super Admin</Label>
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
                {editingUser ? "Guardar Cambios" : "Crear Usuario"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Eliminar Usuario
            </DialogTitle>
            <DialogDescription className="pt-2">
              ¿Estás seguro de que deseas eliminar a{" "}
              <strong>{deleteTarget?.firstName} {deleteTarget?.lastName}</strong>?
              El usuario será desactivado y no podrá acceder al sistema.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting} data-testid="confirm-delete-btn">
              {deleting ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
