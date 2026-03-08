"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Sparkles, Star, Trash2, Link2 } from "lucide-react";
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
import {
  createAiModel,
  updateAiModel,
  deleteAiModel,
  createModelAssignment,
  deleteModelAssignment,
} from "@/lib/actions/ai-models";
import { useToast } from "@/components/ui/use-toast";

interface ModelRow {
  id: string;
  providerId: string;
  modelId: string;
  displayName: string;
  costPer1kInput: number | null;
  costPer1kOutput: number | null;
  maxTokens: number | null;
  isActive: boolean;
  isDefault: boolean;
  providerName: string;
  providerType: string;
}

interface ProviderOption {
  id: string;
  name: string;
  providerType: string;
}

interface AppOption {
  id: string;
  name: string;
  slug: string;
}

interface AssignmentRow {
  id: string;
  appId: string | null;
  modelId: string;
  priority: number;
  isActive: boolean;
  modelDisplayName: string;
  appName: string;
}

interface AiModelsClientProps {
  models: ModelRow[];
  providers: ProviderOption[];
  apps: AppOption[];
  assignments: AssignmentRow[];
}

export function AiModelsClient({
  models,
  providers,
  apps,
  assignments,
}: AiModelsClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ModelRow | null>(null);

  function openCreateModel() {
    setEditing(null);
    setModelDialogOpen(true);
  }

  function openEditModel(m: ModelRow) {
    setEditing(m);
    setModelDialogOpen(true);
  }

  async function handleModelSubmit(formData: FormData) {
    const result = editing
      ? await updateAiModel(formData)
      : await createAiModel(formData);

    if (result.success) {
      toast({ title: editing ? "Modelo actualizado" : "Modelo creado exitosamente" });
      setModelDialogOpen(false);
      router.refresh();
    } else {
      toast({ title: result.error ?? "Error", variant: "destructive" });
    }
  }

  async function handleDeleteModel(id: string) {
    const result = await deleteAiModel(id);
    if (result.success) {
      toast({ title: "Modelo eliminado" });
      router.refresh();
    } else {
      toast({ title: result.error ?? "Error", variant: "destructive" });
    }
  }

  async function handleAssignSubmit(formData: FormData) {
    const result = await createModelAssignment(formData);
    if (result.success) {
      toast({ title: "Asignación creada" });
      setAssignDialogOpen(false);
      router.refresh();
    } else {
      toast({ title: result.error ?? "Error", variant: "destructive" });
    }
  }

  async function handleDeleteAssignment(id: string) {
    const result = await deleteModelAssignment(id);
    if (result.success) {
      toast({ title: "Asignación eliminada" });
      router.refresh();
    } else {
      toast({ title: result.error ?? "Error", variant: "destructive" });
    }
  }

  return (
    <div data-testid="ai-models-page">
      <div className="flex items-center gap-3 mb-6">
        <Sparkles className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Modelos IA</h1>
      </div>

      <Tabs defaultValue="models">
        <TabsList className="mb-4">
          <TabsTrigger value="models">Modelos</TabsTrigger>
          <TabsTrigger value="assignments">Asignaciones</TabsTrigger>
        </TabsList>

        <TabsContent value="models">
          <div className="flex justify-end mb-4">
            <Button onClick={openCreateModel} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Modelo
            </Button>
          </div>

          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Modelo</TableHead>
                  <TableHead className="hidden sm:table-cell">Proveedor</TableHead>
                  <TableHead className="hidden md:table-cell">Max Tokens</TableHead>
                  <TableHead className="hidden md:table-cell">Coste Input</TableHead>
                  <TableHead className="hidden md:table-cell">Coste Output</TableHead>
                  <TableHead className="hidden sm:table-cell">Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {models.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No hay modelos configurados
                    </TableCell>
                  </TableRow>
                ) : (
                  models.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="font-medium">
                              {m.displayName}
                              {m.isDefault && (
                                <Star className="inline h-3 w-3 ml-1 text-amber-500 fill-amber-500" />
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">{m.modelId}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="secondary">{m.providerName}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">
                        {m.maxTokens?.toLocaleString()}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">
                        ${m.costPer1kInput?.toFixed(4) ?? "0.0000"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">
                        ${m.costPer1kOutput?.toFixed(4) ?? "0.0000"}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant={m.isActive ? "success" : "destructive"}>
                          {m.isActive ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditModel(m)}>
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => handleDeleteModel(m.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="assignments">
          <div className="flex justify-end mb-4">
            <Button onClick={() => setAssignDialogOpen(true)} size="sm">
              <Link2 className="h-4 w-4 mr-2" />
              Nueva Asignación
            </Button>
          </div>

          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aplicación</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead className="hidden sm:table-cell">Prioridad</TableHead>
                  <TableHead className="hidden sm:table-cell">Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No hay asignaciones de modelos
                    </TableCell>
                  </TableRow>
                ) : (
                  assignments.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.appName}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{a.modelDisplayName}</Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">{a.priority}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant={a.isActive ? "success" : "destructive"}>
                          {a.isActive ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => handleDeleteAssignment(a.id)}
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
        </TabsContent>
      </Tabs>

      {/* Model Dialog */}
      <Dialog open={modelDialogOpen} onOpenChange={setModelDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Modelo" : "Nuevo Modelo"}</DialogTitle>
          </DialogHeader>
          <form action={handleModelSubmit} className="space-y-4">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div>
              <Label htmlFor="mProvider">Proveedor</Label>
              <Select name="providerId" defaultValue={editing?.providerId ?? providers[0]?.id}>
                <SelectTrigger id="mProvider">
                  <SelectValue placeholder="Seleccionar proveedor" />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="mModelId">ID del modelo</Label>
                <Input
                  id="mModelId"
                  name="modelId"
                  placeholder="claude-sonnet-4-20250514"
                  defaultValue={editing?.modelId ?? ""}
                  required
                />
              </div>
              <div>
                <Label htmlFor="mDisplayName">Nombre visible</Label>
                <Input
                  id="mDisplayName"
                  name="displayName"
                  placeholder="Claude Sonnet 4"
                  defaultValue={editing?.displayName ?? ""}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="mCostIn">Coste/1K input</Label>
                <Input
                  id="mCostIn"
                  name="costPer1kInput"
                  type="number"
                  step="0.0001"
                  min="0"
                  defaultValue={editing?.costPer1kInput ?? 0}
                />
              </div>
              <div>
                <Label htmlFor="mCostOut">Coste/1K output</Label>
                <Input
                  id="mCostOut"
                  name="costPer1kOutput"
                  type="number"
                  step="0.0001"
                  min="0"
                  defaultValue={editing?.costPer1kOutput ?? 0}
                />
              </div>
              <div>
                <Label htmlFor="mMaxTokens">Max tokens</Label>
                <Input
                  id="mMaxTokens"
                  name="maxTokens"
                  type="number"
                  min="1"
                  defaultValue={editing?.maxTokens ?? 4096}
                />
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  id="mActive"
                  name="isActive"
                  defaultChecked={editing?.isActive ?? true}
                  value="true"
                />
                <Label htmlFor="mActive">Activo</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="mDefault"
                  name="isDefault"
                  defaultChecked={editing?.isDefault ?? false}
                  value="true"
                />
                <Label htmlFor="mDefault">Modelo por defecto</Label>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setModelDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">{editing ? "Guardar" : "Crear"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assignment Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Asignación de Modelo</DialogTitle>
          </DialogHeader>
          <form action={handleAssignSubmit} className="space-y-4">
            <div>
              <Label htmlFor="aApp">Aplicación</Label>
              <Select name="appId" defaultValue="">
                <SelectTrigger id="aApp">
                  <SelectValue placeholder="Agente plataforma (general)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Agente plataforma (general)</SelectItem>
                  {apps.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="aModel">Modelo</Label>
              <Select name="modelId">
                <SelectTrigger id="aModel">
                  <SelectValue placeholder="Seleccionar modelo" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.displayName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="aPriority">Prioridad (0 = más alta)</Label>
              <Input id="aPriority" name="priority" type="number" min="0" defaultValue="0" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAssignDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Crear Asignación</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
