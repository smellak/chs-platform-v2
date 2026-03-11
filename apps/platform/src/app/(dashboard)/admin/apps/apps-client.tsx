"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Trash2, Wrench } from "lucide-react";
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
import { createApp, updateApp, deleteApp } from "@/lib/actions/apps";
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

interface CapabilityParameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
  enumValues: string;
}

interface Capability {
  name: string;
  description: string;
  parameters: CapabilityParameter[];
}

interface AppAgent {
  name: string;
  description: string;
  endpoint: string;
  capabilities: Array<{
    name: string;
    description: string;
    parameters: Array<{
      name: string;
      type: string;
      required: boolean;
      description: string;
      enumValues?: string[];
    }>;
  }>;
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
  agent: AppAgent | null;
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
  const [agentEnabled, setAgentEnabled] = useState(false);
  const [agentName, setAgentName] = useState("");
  const [agentDescription, setAgentDescription] = useState("");
  const [agentEndpoint, setAgentEndpoint] = useState("");
  const [capabilities, setCapabilities] = useState<Capability[]>([]);

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
    setAgentEnabled(false);
    setAgentName("");
    setAgentDescription("");
    setAgentEndpoint("");
    setCapabilities([]);
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
    if (app.agent) {
      setAgentEnabled(true);
      setAgentName(app.agent.name);
      setAgentDescription(app.agent.description);
      setAgentEndpoint(app.agent.endpoint);
      setCapabilities(
        app.agent.capabilities.map((cap) => ({
          name: cap.name,
          description: cap.description,
          parameters: cap.parameters.map((p) => ({
            name: p.name,
            type: p.type,
            required: p.required,
            description: p.description,
            enumValues: p.enumValues ? p.enumValues.join(", ") : "",
          })),
        })),
      );
    } else {
      setAgentEnabled(false);
      setAgentName("");
      setAgentDescription("");
      setAgentEndpoint("");
      setCapabilities([]);
    }
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

  function addCapability() {
    setCapabilities((prev) => [
      ...prev,
      { name: "", description: "", parameters: [] },
    ]);
  }

  function removeCapability(index: number) {
    setCapabilities((prev) => prev.filter((_, i) => i !== index));
  }

  function updateCapability(
    index: number,
    field: keyof Omit<Capability, "parameters">,
    value: string,
  ) {
    setCapabilities((prev) =>
      prev.map((cap, i) => (i === index ? { ...cap, [field]: value } : cap)),
    );
  }

  function addParameter(capIndex: number) {
    setCapabilities((prev) =>
      prev.map((cap, i) =>
        i === capIndex
          ? {
              ...cap,
              parameters: [
                ...cap.parameters,
                {
                  name: "",
                  type: "string",
                  required: false,
                  description: "",
                  enumValues: "",
                },
              ],
            }
          : cap,
      ),
    );
  }

  function removeParameter(capIndex: number, paramIndex: number) {
    setCapabilities((prev) =>
      prev.map((cap, i) =>
        i === capIndex
          ? {
              ...cap,
              parameters: cap.parameters.filter((_, j) => j !== paramIndex),
            }
          : cap,
      ),
    );
  }

  function updateParameter(
    capIndex: number,
    paramIndex: number,
    field: keyof CapabilityParameter,
    value: string | boolean,
  ) {
    setCapabilities((prev) =>
      prev.map((cap, i) =>
        i === capIndex
          ? {
              ...cap,
              parameters: cap.parameters.map((p, j) =>
                j === paramIndex ? { ...p, [field]: value } : p,
              ),
            }
          : cap,
      ),
    );
  }

  async function handleDelete(appId: string) {
    if (!confirm("¿Seguro que deseas eliminar esta aplicación?")) return;
    const result = await deleteApp(appId);
    if (result.success) {
      toast({ title: "Aplicación eliminada" });
      router.refresh();
    } else {
      toast({ title: result.error ?? "Error al eliminar", variant: "destructive" });
    }
  }

  async function handleSubmit(formData: FormData) {
    // Signal that access policies are being managed in this submission
    formData.append("accessManaged", "true");
    // Add access entries
    for (const [deptId, level] of Object.entries(accessMap)) {
      formData.append("access", `${deptId}:${level}`);
    }

    // Add agent data
    formData.append("agentEnabled", agentEnabled ? "true" : "false");
    if (agentEnabled) {
      formData.append("agentName", agentName);
      formData.append("agentDescription", agentDescription);
      formData.append("agentEndpoint", agentEndpoint);
      formData.append(
        "agentCapabilities",
        JSON.stringify(
          capabilities.map((cap) => ({
            name: cap.name,
            description: cap.description,
            parameters: cap.parameters.map((p) => ({
              name: p.name,
              type: p.type,
              required: p.required,
              description: p.description,
              ...(p.type === "enum" && p.enumValues
                ? {
                    enumValues: p.enumValues
                      .split(",")
                      .map((v) => v.trim())
                      .filter(Boolean),
                  }
                : {}),
            })),
          })),
        ),
      );
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
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(app)}>
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(app.id)}
                      >
                        <Trash2 className="h-4 w-4" />
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

              <TabsContent value="data" forceMount className="space-y-4 data-[state=inactive]:hidden">
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

              <TabsContent value="instance" forceMount className="space-y-4 data-[state=inactive]:hidden">
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

              <TabsContent value="access" forceMount className="space-y-4 data-[state=inactive]:hidden">
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

              <TabsContent value="agent" forceMount className="space-y-4 data-[state=inactive]:hidden">
                <div className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div>
                    <Label htmlFor="agentEnabled" className="text-sm font-medium">
                      Habilitar Agente IA
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Activa un agente de inteligencia artificial para esta
                      aplicación.
                    </p>
                  </div>
                  <Switch
                    id="agentEnabled"
                    checked={agentEnabled}
                    onCheckedChange={setAgentEnabled}
                  />
                </div>

                {agentEnabled && (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-border p-4 space-y-4">
                      <h3 className="text-sm font-semibold">
                        Configuración del Agente
                      </h3>
                      <div>
                        <Label htmlFor="agentName" className="text-sm">
                          Nombre del agente
                        </Label>
                        <Input
                          id="agentName"
                          value={agentName}
                          onChange={(e) => setAgentName(e.target.value)}
                          placeholder="Agente de Citas"
                        />
                      </div>
                      <div>
                        <Label htmlFor="agentDescription" className="text-sm">
                          Descripción
                        </Label>
                        <Textarea
                          id="agentDescription"
                          value={agentDescription}
                          onChange={(e) => setAgentDescription(e.target.value)}
                          placeholder="Gestiona citas y reservas"
                          rows={3}
                        />
                      </div>
                      <div>
                        <Label htmlFor="agentEndpoint" className="text-sm">
                          Endpoint del agente
                        </Label>
                        <Input
                          id="agentEndpoint"
                          value={agentEndpoint}
                          onChange={(e) => setAgentEndpoint(e.target.value)}
                          placeholder="http://citas:3000/api/agent"
                        />
                      </div>
                    </div>

                    <div className="rounded-lg border border-border p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Wrench className="h-4 w-4 text-muted-foreground" />
                          <h3 className="text-sm font-semibold">
                            Capacidades
                          </h3>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addCapability}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Agregar capacidad
                        </Button>
                      </div>

                      {capabilities.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No hay capacidades configuradas. Agrega una para
                          definir lo que el agente puede hacer.
                        </p>
                      )}

                      {capabilities.map((cap, capIndex) => (
                        <div
                          key={capIndex}
                          className="rounded-lg border border-border p-4 space-y-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 space-y-3">
                              <div>
                                <Label className="text-sm">
                                  Nombre de la capacidad
                                </Label>
                                <Input
                                  value={cap.name}
                                  onChange={(e) =>
                                    updateCapability(
                                      capIndex,
                                      "name",
                                      e.target.value,
                                    )
                                  }
                                  placeholder="crearCita"
                                />
                              </div>
                              <div>
                                <Label className="text-sm">Descripción</Label>
                                <Input
                                  value={cap.description}
                                  onChange={(e) =>
                                    updateCapability(
                                      capIndex,
                                      "description",
                                      e.target.value,
                                    )
                                  }
                                  placeholder="Crea una nueva cita en el sistema"
                                />
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => removeCapability(capIndex)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm text-muted-foreground">
                                Parámetros
                              </Label>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => addParameter(capIndex)}
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Agregar parámetro
                              </Button>
                            </div>

                            {cap.parameters.map((param, paramIndex) => (
                              <div
                                key={paramIndex}
                                className="rounded border border-border p-3 space-y-2 bg-muted/30"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 grid grid-cols-2 gap-2">
                                    <div>
                                      <Label className="text-sm">Nombre</Label>
                                      <Input
                                        value={param.name}
                                        onChange={(e) =>
                                          updateParameter(
                                            capIndex,
                                            paramIndex,
                                            "name",
                                            e.target.value,
                                          )
                                        }
                                        placeholder="fecha"
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-sm">Tipo</Label>
                                      <select
                                        value={param.type}
                                        onChange={(e) =>
                                          updateParameter(
                                            capIndex,
                                            paramIndex,
                                            "type",
                                            e.target.value,
                                          )
                                        }
                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                      >
                                        <option value="string">string</option>
                                        <option value="number">number</option>
                                        <option value="boolean">boolean</option>
                                        <option value="enum">enum</option>
                                      </select>
                                    </div>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive mt-5"
                                    onClick={() =>
                                      removeParameter(capIndex, paramIndex)
                                    }
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                                <div>
                                  <Label className="text-sm">Descripción</Label>
                                  <Input
                                    value={param.description}
                                    onChange={(e) =>
                                      updateParameter(
                                        capIndex,
                                        paramIndex,
                                        "description",
                                        e.target.value,
                                      )
                                    }
                                    placeholder="Fecha de la cita en formato YYYY-MM-DD"
                                  />
                                </div>
                                {param.type === "enum" && (
                                  <div>
                                    <Label className="text-sm">
                                      Valores enum (separados por coma)
                                    </Label>
                                    <Input
                                      value={param.enumValues}
                                      onChange={(e) =>
                                        updateParameter(
                                          capIndex,
                                          paramIndex,
                                          "enumValues",
                                          e.target.value,
                                        )
                                      }
                                      placeholder="opcion1, opcion2, opcion3"
                                    />
                                  </div>
                                )}
                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    checked={param.required}
                                    onCheckedChange={(checked) =>
                                      updateParameter(
                                        capIndex,
                                        paramIndex,
                                        "required",
                                        !!checked,
                                      )
                                    }
                                  />
                                  <Label className="text-sm">Requerido</Label>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
