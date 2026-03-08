"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Cpu, Eye, EyeOff } from "lucide-react";
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
import {
  createApiProvider,
  updateApiProvider,
} from "@/lib/actions/api-providers";
import { slugify } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

const PROVIDER_TYPES = [
  { value: "anthropic", label: "Anthropic" },
  { value: "openai", label: "OpenAI" },
  { value: "google", label: "Google AI" },
  { value: "xai", label: "xAI (Grok)" },
] as const;

interface ProviderRow {
  id: string;
  name: string;
  slug: string;
  providerType: string;
  model: string | null;
  baseUrl: string | null;
  hasApiKey: boolean;
  costPer1kInput: number | null;
  costPer1kOutput: number | null;
  isActive: boolean;
}

interface ApiProvidersClientProps {
  providers: ProviderRow[];
}

export function ApiProvidersClient({ providers }: ApiProvidersClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProviderRow | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [providerType, setProviderType] = useState("anthropic");
  const [showApiKey, setShowApiKey] = useState(false);

  function openCreate() {
    setEditing(null);
    setName("");
    setSlug("");
    setProviderType("anthropic");
    setShowApiKey(false);
    setDialogOpen(true);
  }

  function openEdit(p: ProviderRow) {
    setEditing(p);
    setName(p.name);
    setSlug(p.slug);
    setProviderType(p.providerType);
    setShowApiKey(false);
    setDialogOpen(true);
  }

  async function handleSubmit(formData: FormData) {
    const result = editing
      ? await updateApiProvider(formData)
      : await createApiProvider(formData);

    if (result.success) {
      toast({
        title: editing
          ? "Proveedor actualizado"
          : "Proveedor creado exitosamente",
      });
      setDialogOpen(false);
      router.refresh();
    } else {
      toast({ title: result.error ?? "Error", variant: "destructive" });
    }
  }

  function getProviderLabel(type: string): string {
    return PROVIDER_TYPES.find((p) => p.value === type)?.label ?? type;
  }

  return (
    <div data-testid="api-providers-page">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Cpu className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Proveedores API</h1>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Proveedor
        </Button>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Proveedor</TableHead>
              <TableHead className="hidden sm:table-cell">Tipo</TableHead>
              <TableHead className="hidden sm:table-cell">Modelo</TableHead>
              <TableHead className="hidden md:table-cell">API Key</TableHead>
              <TableHead className="hidden sm:table-cell">Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {providers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No hay proveedores API
                </TableCell>
              </TableRow>
            ) : (
              providers.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.slug}</div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant="secondary">{getProviderLabel(p.providerType)}</Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                    {p.model ?? "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm">
                    {p.hasApiKey ? (
                      <Badge variant="outline" className="text-emerald-600">Configurada</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">No configurada</Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant={p.isActive ? "success" : "destructive"}>
                      {p.isActive ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                      Editar
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar Proveedor" : "Nuevo Proveedor"}
            </DialogTitle>
          </DialogHeader>
          <form action={handleSubmit} className="space-y-4">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div>
              <Label htmlFor="provName">Nombre</Label>
              <Input
                id="provName"
                name="name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!editing) setSlug(slugify(e.target.value));
                }}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="provSlug">Slug</Label>
                <Input
                  id="provSlug"
                  name="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="provType">Tipo de proveedor</Label>
                <Select
                  name="providerType"
                  value={providerType}
                  onValueChange={setProviderType}
                >
                  <SelectTrigger id="provType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDER_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="provApiKey">API Key</Label>
              <div className="relative">
                <Input
                  id="provApiKey"
                  name="apiKey"
                  type={showApiKey ? "text" : "password"}
                  placeholder={editing?.hasApiKey ? "••••••••  (dejar vacío para no cambiar)" : "sk-..."}
                  autoComplete="off"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div>
              <Label htmlFor="provBaseUrl">Base URL (opcional)</Label>
              <Input
                id="provBaseUrl"
                name="baseUrl"
                placeholder="https://api.example.com/v1"
                defaultValue={editing?.baseUrl ?? ""}
              />
            </div>
            <div>
              <Label htmlFor="provModel">Modelo por defecto</Label>
              <Input
                id="provModel"
                name="model"
                placeholder="claude-sonnet-4-20250514"
                defaultValue={editing?.model ?? ""}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="costInput">Coste/1K tokens (input)</Label>
                <Input
                  id="costInput"
                  name="costPer1kInput"
                  type="number"
                  step="0.0001"
                  min="0"
                  defaultValue={editing?.costPer1kInput ?? 0}
                />
              </div>
              <div>
                <Label htmlFor="costOutput">Coste/1K tokens (output)</Label>
                <Input
                  id="costOutput"
                  name="costPer1kOutput"
                  type="number"
                  step="0.0001"
                  min="0"
                  defaultValue={editing?.costPer1kOutput ?? 0}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="provActive"
                name="isActive"
                defaultChecked={editing?.isActive ?? true}
                value="true"
              />
              <Label htmlFor="provActive">Activo</Label>
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
                {editing ? "Guardar Cambios" : "Crear Proveedor"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
