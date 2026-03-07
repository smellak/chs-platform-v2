"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DynamicIcon } from "@/components/dynamic-icon";
import { createApp, updateApp } from "@/lib/actions/apps";
import {
  previewTraefikConfig,
  applyTraefikConfig,
  removeTraefikConfig,
  checkAppConnectivity,
} from "@/lib/actions/traefik";
import { slugify } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

interface AppInstance {
  internalUrl: string;
  externalDomain: string | null;
  healthEndpoint: string | null;
  publicPaths: string[] | null;
  status: string | null;
}

interface AppAccess {
  departmentId: string;
  accessLevel: string;
  departmentName: string;
}

interface AppRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  category: string | null;
  version: string | null;
  isActive: boolean;
  isMaintenance: boolean;
  instance: AppInstance | null;
  access: AppAccess[];
}

interface AppsClientProps {
  apps: AppRow[];
  departments: { id: string; name: string }[];
}

export function AppsClient({ apps, departments }: AppsClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AppRow | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [accessMap, setAccessMap] = useState<Record<string, string>>({});
  const [yamlPreview, setYamlPreview] = useState<string | null>(null);
  const [connectivityResult, setConnectivityResult] = useState<string | null>(null);

  const filtered = apps.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.slug.toLowerCase().includes(search.toLowerCase()),
  );

  function openCreate() {
    setEditing(null);
    setName("");
    setSlug("");
    setAccessMap({});
    setDialogOpen(true);
  }

  function openEdit(app: AppRow) {
    setEditing(app);
    setName(app.name);
    setSlug(app.slug);
    const am: Record<string, string> = {};
    for (const a of app.access) {
      am[a.departmentId] = a.accessLevel;
    }
    setAccessMap(am);
    setDialogOpen(true);
  }

  function toggleDeptAccess(deptId: string) {
    setAccessMap((prev) => {
      const copy = { ...prev };
      if (copy[deptId]) {
        delete copy[deptId];
      } else {
        copy[deptId] = "full";
      }
      return copy;
    });
  }

  function setAccessLevel(deptId: string, level: string) {
    setAccessMap((prev) => ({ ...prev, [deptId]: level }));
  }

  async function handleSubmit(formData: FormData) {
    // Add access entries
    for (const [deptId, level] of Object.entries(accessMap)) {
      formData.append("access", `${deptId}:${level}`);
    }

    const result = editing
      ? await updateApp(formData)
      : await createApp(formData);

    if (result.success) {
      toast({
        title: editing
          ? "Aplicación actualizada"
          : "Aplicación creada exitosamente",
      });
      setDialogOpen(false);
      router.refresh();
    } else {
      toast({ title: result.error ?? "Error", variant: "destructive" });
    }
  }

  function getStatusBadge(app: AppRow) {
    if (app.isMaintenance) return { label: "Mantenimiento", variant: "warning" as const };
    if (!app.isActive) return { label: "Inactiva", variant: "destructive" as const };
    const status = app.instance?.status;
    if (status === "online") return { label: "Operativo", variant: "success" as const };
    if (status === "offline") return { label: "Fuera de línea", variant: "destructive" as const };
    return { label: "Sin datos", variant: "secondary" as const };
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Gestión de Aplicaciones</h1>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Nueva Aplicación
        </Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar aplicaciones..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Aplicación</TableHead>
              <TableHead className="hidden md:table-cell">Categoría</TableHead>
              <TableHead className="hidden sm:table-cell">Estado</TableHead>
              <TableHead className="hidden lg:table-cell">Departamentos</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No hay aplicaciones
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((app) => {
                const badge = getStatusBadge(app);
                return (
                  <TableRow key={app.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center"
                          style={{
                            background: app.color
                              ? `linear-gradient(135deg, ${app.color}, ${app.color}CC)`
                              : "hsl(var(--muted))",
                          }}
                        >
                          {app.icon && (
                            <DynamicIcon
                              name={app.icon}
                              className="h-4 w-4 text-white"
                            />
                          )}
                        </div>
                        <div>
                          <div className="font-medium">{app.name}</div>
                          <div className="text-xs text-muted-foreground">
                            v{app.version}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {app.category ?? "—"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {app.access.length > 0
                        ? app.access.map((a) => a.departmentName).join(", ")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(app)}>
                        Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar Aplicación" : "Nueva Aplicación"}
            </DialogTitle>
          </DialogHeader>
          <form action={handleSubmit}>
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <Tabs defaultValue="data" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="data">Datos</TabsTrigger>
                <TabsTrigger value="instance">Instancia</TabsTrigger>
                <TabsTrigger value="access">Acceso</TabsTrigger>
                <TabsTrigger value="agent">Agente IA</TabsTrigger>
              </TabsList>

              <TabsContent value="data" className="space-y-4">
                <div>
                  <Label htmlFor="appName">Nombre</Label>
                  <Input
                    id="appName"
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
                  <Label htmlFor="appSlug">Slug</Label>
                  <Input
                    id="appSlug"
                    name="slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="appDesc">Descripción</Label>
                  <Textarea
                    id="appDesc"
                    name="description"
                    defaultValue={editing?.description ?? ""}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="appCategory">Categoría</Label>
                    <Input
                      id="appCategory"
                      name="category"
                      defaultValue={editing?.category ?? ""}
                    />
                  </div>
                  <div>
                    <Label htmlFor="appIcon">Icono</Label>
                    <Input
                      id="appIcon"
                      name="icon"
                      placeholder="AppWindow"
                      defaultValue={editing?.icon ?? ""}
                    />
                  </div>
                  <div>
                    <Label htmlFor="appColor">Color</Label>
                    <Input
                      id="appColor"
                      name="color"
                      type="color"
                      defaultValue={editing?.color ?? "#3B82F6"}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="appVersion">Versión</Label>
                    <Input
                      id="appVersion"
                      name="version"
                      defaultValue={editing?.version ?? "1.0"}
                    />
                  </div>
                  <div className="flex items-center gap-6 pt-6">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="isActive"
                        name="isActive"
                        defaultChecked={editing?.isActive ?? true}
                        value="true"
                      />
                      <Label htmlFor="isActive">Activa</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="isMaintenance"
                        name="isMaintenance"
                        defaultChecked={editing?.isMaintenance ?? false}
                        value="true"
                      />
                      <Label htmlFor="isMaintenance">Mantenimiento</Label>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="instance" className="space-y-4">
                <div>
                  <Label htmlFor="internalUrl">URL interna</Label>
                  <Input
                    id="internalUrl"
                    name="internalUrl"
                    placeholder="http://app:3000"
                    defaultValue={editing?.instance?.internalUrl ?? ""}
                  />
                </div>
                <div>
                  <Label htmlFor="externalDomain">Dominio externo</Label>
                  <Input
                    id="externalDomain"
                    name="externalDomain"
                    placeholder="app.example.com"
                    defaultValue={editing?.instance?.externalDomain ?? ""}
                  />
                </div>
                <div>
                  <Label htmlFor="healthEndpoint">Health endpoint</Label>
                  <Input
                    id="healthEndpoint"
                    name="healthEndpoint"
                    defaultValue={editing?.instance?.healthEndpoint ?? "/api/health"}
                  />
                </div>
                <div>
                  <Label htmlFor="publicPaths">Rutas públicas (una por línea)</Label>
                  <Textarea
                    id="publicPaths"
                    name="publicPaths"
                    rows={4}
                    defaultValue={
                      editing?.instance?.publicPaths?.join("\n") ?? ""
                    }
                  />
                </div>

                {editing && editing.instance?.externalDomain && (
                  <div className="border-t border-border pt-4 space-y-3">
                    <h3 className="text-sm font-semibold">Proxy Traefik</h3>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          const result = await previewTraefikConfig(editing.id);
                          if (result.success && result.yaml) {
                            setYamlPreview(result.yaml);
                          } else {
                            toast({ title: result.error ?? "Error", variant: "destructive" });
                          }
                        }}
                      >
                        Vista previa YAML
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          const result = await applyTraefikConfig(editing.id);
                          if (result.success) {
                            toast({ title: "Configuración de proxy aplicada" });
                          } else {
                            toast({ title: result.error ?? "Error", variant: "destructive" });
                          }
                        }}
                      >
                        Aplicar proxy
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          const result = await removeTraefikConfig(editing.id);
                          if (result.success) {
                            toast({ title: "Configuración de proxy eliminada" });
                          } else {
                            toast({ title: result.error ?? "Error", variant: "destructive" });
                          }
                        }}
                      >
                        Eliminar proxy
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          const result = await checkAppConnectivity(editing.id);
                          if (result.error) {
                            setConnectivityResult(`Error: ${result.error}`);
                          } else {
                            setConnectivityResult(`HTTP ${result.status} — ${result.responseMs}ms`);
                          }
                        }}
                      >
                        Verificar conectividad
                      </Button>
                    </div>
                    {connectivityResult && (
                      <p className="text-sm text-muted-foreground">{connectivityResult}</p>
                    )}
                    {yamlPreview && (
                      <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto max-h-60 whitespace-pre">
                        {yamlPreview}
                      </pre>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="access" className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Selecciona los departamentos que tendrán acceso a esta
                  aplicación.
                </p>
                <div className="space-y-3">
                  {departments.map((dept) => (
                    <div
                      key={dept.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border"
                    >
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={!!accessMap[dept.id]}
                          onCheckedChange={() => toggleDeptAccess(dept.id)}
                        />
                        <span className="text-sm font-medium">{dept.name}</span>
                      </div>
                      {accessMap[dept.id] && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setAccessLevel(dept.id, "full")}
                            className={`text-xs px-2 py-1 rounded ${
                              accessMap[dept.id] === "full"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            Completo
                          </button>
                          <button
                            type="button"
                            onClick={() => setAccessLevel(dept.id, "readonly")}
                            className={`text-xs px-2 py-1 rounded ${
                              accessMap[dept.id] === "readonly"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            Solo lectura
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="agent" className="space-y-4">
                <div className="rounded-lg border border-border p-6 text-center">
                  <p className="text-muted-foreground text-sm">
                    La configuración de agentes IA se activará en una versión
                    futura.
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit">
                {editing ? "Guardar Cambios" : "Crear Aplicación"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
