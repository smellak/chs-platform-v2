"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ShieldCheck, Trash2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  createAgentPermission,
  deleteAgentPermission,
} from "@/lib/actions/ai-permissions";
import { useToast } from "@/components/ui/use-toast";

interface PermissionRow {
  id: string;
  targetType: string;
  targetId: string;
  targetName: string;
  appId: string | null;
  appName: string;
  canAccess: boolean;
  blockedTools: string[];
  allowedModels: string[];
  maxTokensPerDay: number | null;
  maxMessagesPerHour: number | null;
}

interface Option {
  id: string;
  name: string;
}

interface UserOption extends Option {
  email: string;
}

interface ModelOption {
  id: string;
  displayName: string;
}

interface AiPermissionsClientProps {
  permissions: PermissionRow[];
  departments: Option[];
  roles: Option[];
  users: UserOption[];
  apps: Option[];
  models: ModelOption[];
}

const TARGET_LABELS: Record<string, string> = {
  department: "Departamento",
  role: "Rol",
  user: "Usuario",
};

export function AiPermissionsClient({
  permissions,
  departments,
  roles,
  users,
  apps,
  models,
}: AiPermissionsClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [targetType, setTargetType] = useState("department");

  function getTargetOptions(): Option[] {
    switch (targetType) {
      case "department": return departments;
      case "role": return roles;
      case "user": return users;
      default: return [];
    }
  }

  async function handleSubmit(formData: FormData) {
    const result = await createAgentPermission(formData);
    if (result.success) {
      toast({ title: "Regla de permiso creada" });
      setDialogOpen(false);
      router.refresh();
    } else {
      toast({ title: result.error ?? "Error", variant: "destructive" });
    }
  }

  async function handleDelete(id: string) {
    const result = await deleteAgentPermission(id);
    if (result.success) {
      toast({ title: "Regla eliminada" });
      router.refresh();
    } else {
      toast({ title: result.error ?? "Error", variant: "destructive" });
    }
  }

  function renderTable(type: string) {
    const filtered = permissions.filter((p) => p.targetType === type);

    return (
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{TARGET_LABELS[type]}</TableHead>
              <TableHead>App</TableHead>
              <TableHead className="hidden sm:table-cell">Acceso</TableHead>
              <TableHead className="hidden md:table-cell">Herr. bloqueadas</TableHead>
              <TableHead className="hidden lg:table-cell">Límites</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No hay reglas de permisos para {TARGET_LABELS[type]?.toLowerCase()}s
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.targetName}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{p.appName}</Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant={p.canAccess ? "success" : "destructive"}>
                      {p.canAccess ? "Permitido" : "Bloqueado"}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm">
                    {p.blockedTools.length > 0 ? (
                      <span className="text-amber-600">{p.blockedTools.length} bloqueadas</span>
                    ) : (
                      <span className="text-muted-foreground">Ninguna</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                    {p.maxMessagesPerHour !== null && `${p.maxMessagesPerHour} msg/h`}
                    {p.maxMessagesPerHour !== null && p.maxTokensPerDay !== null && " · "}
                    {p.maxTokensPerDay !== null && `${p.maxTokensPerDay.toLocaleString()} tok/día`}
                    {p.maxMessagesPerHour === null && p.maxTokensPerDay === null && "Por defecto"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => handleDelete(p.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div data-testid="ai-permissions-page">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Permisos del Agente IA</h1>
        </div>
        <Button onClick={() => setDialogOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Nueva Regla
        </Button>
      </div>

      <Tabs defaultValue="department">
        <TabsList className="mb-4">
          <TabsTrigger value="department">Por Departamento</TabsTrigger>
          <TabsTrigger value="role">Por Rol</TabsTrigger>
          <TabsTrigger value="user">Por Usuario</TabsTrigger>
        </TabsList>

        <TabsContent value="department">{renderTable("department")}</TabsContent>
        <TabsContent value="role">{renderTable("role")}</TabsContent>
        <TabsContent value="user">{renderTable("user")}</TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nueva Regla de Permiso</DialogTitle>
          </DialogHeader>
          <form action={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="pTargetType">Tipo de objetivo</Label>
                <Select
                  name="targetType"
                  value={targetType}
                  onValueChange={setTargetType}
                >
                  <SelectTrigger id="pTargetType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="department">Departamento</SelectItem>
                    <SelectItem value="role">Rol</SelectItem>
                    <SelectItem value="user">Usuario</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="pTargetId">
                  {TARGET_LABELS[targetType] ?? "Objetivo"}
                </Label>
                <Select name="targetId">
                  <SelectTrigger id="pTargetId">
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {getTargetOptions().map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>{opt.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="pAppId">Aplicación (vacío = todas)</Label>
              <Select name="appId" defaultValue="">
                <SelectTrigger id="pAppId">
                  <SelectValue placeholder="Todas las aplicaciones" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Todas las aplicaciones</SelectItem>
                  {apps.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Switch id="pCanAccess" name="canAccess" defaultChecked={true} value="true" />
              <Label htmlFor="pCanAccess">Permitir acceso al agente</Label>
            </div>

            <div>
              <Label htmlFor="pBlockedTools">Herramientas bloqueadas (separadas por coma)</Label>
              <Textarea
                id="pBlockedTools"
                name="blockedTools"
                placeholder="crear_cita, gestionar_acceso_app"
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="pAllowedModels">Modelos permitidos (separados por coma, vacío = todos)</Label>
              <Textarea
                id="pAllowedModels"
                name="allowedModels"
                placeholder={models.map((m) => m.id).join(", ")}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="pMsgLimit">Mensajes/hora (vacío = por defecto)</Label>
                <Input
                  id="pMsgLimit"
                  name="maxMessagesPerHour"
                  type="number"
                  min="0"
                  placeholder="50"
                />
              </div>
              <div>
                <Label htmlFor="pTokenLimit">Tokens/día (vacío = por defecto)</Label>
                <Input
                  id="pTokenLimit"
                  name="maxTokensPerDay"
                  type="number"
                  min="0"
                  placeholder="100000"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Crear Regla</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
