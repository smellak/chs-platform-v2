"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Cpu,
  Eye,
  EyeOff,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
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
  deleteApiProvider,
} from "@/lib/actions/api-providers";
import { slugify } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import {
  AI_MODELS_CATALOG,
  pricePer1MTo1K,
  formatModelPrice,
  type CatalogModel,
} from "@/lib/ai-models-catalog";

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
  const [providerType, setProviderType] = useState("google");
  const [selectedModel, setSelectedModel] = useState("");
  const [costInput, setCostInput] = useState("0");
  const [costOutput, setCostOutput] = useState("0");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKeyValue, setApiKeyValue] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [decryptedKey, setDecryptedKey] = useState<string | null>(null);
  const [loadingDecrypt, setLoadingDecrypt] = useState(false);
  const [validatingKey, setValidatingKey] = useState(false);
  const [keyValidation, setKeyValidation] = useState<{
    valid: boolean;
    detail: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [previousProviderType, setPreviousProviderType] = useState("");

  const getModelsForProvider = useCallback(
    (type: string): CatalogModel[] => {
      return AI_MODELS_CATALOG[type]?.models ?? [];
    },
    [],
  );

  const getBaseUrlForProvider = useCallback((type: string): string => {
    return AI_MODELS_CATALOG[type]?.baseUrl ?? "";
  }, []);

  function resetForm() {
    setName("");
    setSlug("");
    setProviderType("google");
    setSelectedModel("");
    setCostInput("0");
    setCostOutput("0");
    setBaseUrl(getBaseUrlForProvider("google"));
    setApiKeyValue("");
    setShowApiKey(false);
    setDecryptedKey(null);
    setKeyValidation(null);
    setPreviousProviderType("");
  }

  function openCreate() {
    setEditing(null);
    resetForm();
    setDialogOpen(true);
  }

  function openEdit(p: ProviderRow) {
    setEditing(p);
    setName(p.name);
    setSlug(p.slug);
    setProviderType(p.providerType);
    setPreviousProviderType(p.providerType);
    setSelectedModel(p.model ?? "");
    setCostInput(String(p.costPer1kInput ?? 0));
    setCostOutput(String(p.costPer1kOutput ?? 0));
    setBaseUrl(p.baseUrl ?? getBaseUrlForProvider(p.providerType));
    setApiKeyValue("");
    setShowApiKey(false);
    setDecryptedKey(null);
    setKeyValidation(null);
    setDialogOpen(true);
  }

  function handleProviderTypeChange(newType: string) {
    // Warn if changing provider type with existing API key
    if (editing?.hasApiKey && newType !== previousProviderType) {
      toast({
        title: "Aviso: cambio de proveedor",
        description:
          "La API key actual no será válida para el nuevo proveedor. Deberás introducir una nueva.",
        variant: "destructive",
      });
    }

    setProviderType(newType);
    setBaseUrl(getBaseUrlForProvider(newType));
    setSelectedModel("");
    setKeyValidation(null);
    setDecryptedKey(null);

    // Auto-fill costs from first model of new provider
    const models = getModelsForProvider(newType);
    if (models.length > 0) {
      const first = models[0]!;
      setCostInput(String(pricePer1MTo1K(first.inputPricePer1M)));
      setCostOutput(String(pricePer1MTo1K(first.outputPricePer1M)));
    }
  }

  function handleModelSelect(modelId: string) {
    setSelectedModel(modelId);
    const models = getModelsForProvider(providerType);
    const model = models.find((m) => m.id === modelId);
    if (model) {
      setCostInput(String(pricePer1MTo1K(model.inputPricePer1M)));
      setCostOutput(String(pricePer1MTo1K(model.outputPricePer1M)));
    }
  }

  async function handleToggleShowKey() {
    if (showApiKey) {
      // Hide key
      setShowApiKey(false);
      setDecryptedKey(null);
      return;
    }

    // If there's a typed value, just show it
    if (apiKeyValue) {
      setShowApiKey(true);
      return;
    }

    // If editing and has existing key, fetch decrypted
    if (editing?.hasApiKey) {
      setLoadingDecrypt(true);
      try {
        const res = await fetch(
          `/api/admin/providers/${editing.id}/decrypt-key`,
        );
        if (res.ok) {
          const data = (await res.json()) as { apiKey: string };
          setDecryptedKey(data.apiKey);
          setShowApiKey(true);
        } else {
          toast({
            title: "Error al descifrar la API key",
            variant: "destructive",
          });
        }
      } catch {
        toast({
          title: "Error de conexión",
          variant: "destructive",
        });
      } finally {
        setLoadingDecrypt(false);
      }
    } else {
      setShowApiKey(true);
    }
  }

  async function handleValidateKey() {
    const keyToValidate = apiKeyValue || decryptedKey;
    if (!keyToValidate) {
      toast({
        title: "Introduce una API key para validar",
        variant: "destructive",
      });
      return;
    }

    setValidatingKey(true);
    setKeyValidation(null);

    try {
      const res = await fetch("/api/admin/providers/validate-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerType, apiKey: keyToValidate }),
      });
      const data = (await res.json()) as { valid: boolean; detail: string };
      setKeyValidation(data);
    } catch {
      setKeyValidation({ valid: false, detail: "Error de conexión" });
    } finally {
      setValidatingKey(false);
    }
  }

  async function handleDelete(providerId: string) {
    if (!confirm("¿Seguro que deseas eliminar este proveedor?")) return;
    const result = await deleteApiProvider(providerId);
    if (result.success) {
      toast({ title: "Proveedor eliminado" });
      router.refresh();
    } else {
      toast({
        title: result.error ?? "Error al eliminar",
        variant: "destructive",
      });
    }
  }

  async function handleSubmit(formData: FormData) {
    setSubmitting(true);

    // Validate API key if a new one is provided
    const rawKey = formData.get("apiKey") as string;
    if (rawKey && rawKey.trim().length > 0 && !keyValidation?.valid) {
      setValidatingKey(true);
      try {
        const res = await fetch("/api/admin/providers/validate-key", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            providerType,
            apiKey: rawKey.trim(),
          }),
        });
        const data = (await res.json()) as { valid: boolean; detail: string };
        setKeyValidation(data);
        if (!data.valid) {
          toast({
            title: "API key inválida",
            description: data.detail || "La key no es válida para este proveedor",
            variant: "destructive",
          });
          setSubmitting(false);
          setValidatingKey(false);
          return;
        }
      } catch {
        toast({
          title: "No se pudo validar la API key",
          variant: "destructive",
        });
        setSubmitting(false);
        setValidatingKey(false);
        return;
      }
      setValidatingKey(false);
    }

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
    setSubmitting(false);
  }

  function getProviderLabel(type: string): string {
    return PROVIDER_TYPES.find((p) => p.value === type)?.label ?? type;
  }

  const currentModels = getModelsForProvider(providerType);
  const displayKey =
    apiKeyValue || (showApiKey && decryptedKey ? decryptedKey : "");

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
              <TableHead className="hidden lg:table-cell">
                Coste (1K tok)
              </TableHead>
              <TableHead className="hidden sm:table-cell">Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {providers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-8 text-muted-foreground"
                >
                  No hay proveedores API
                </TableCell>
              </TableRow>
            ) : (
              providers.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.slug}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant="secondary">
                      {getProviderLabel(p.providerType)}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                    {p.model ?? "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm">
                    {p.hasApiKey ? (
                      <Badge variant="outline" className="text-emerald-600">
                        Configurada
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-muted-foreground"
                      >
                        No configurada
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-muted-foreground font-mono">
                    {p.costPer1kInput != null && p.costPer1kOutput != null
                      ? `$${Number(p.costPer1kInput).toFixed(4)} / $${Number(p.costPer1kOutput).toFixed(4)}`
                      : "—"}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge
                      variant={p.isActive ? "success" : "destructive"}
                    >
                      {p.isActive ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(p)}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar Proveedor" : "Nuevo Proveedor"}
            </DialogTitle>
          </DialogHeader>
          <form action={handleSubmit} className="space-y-4">
            {editing && <input type="hidden" name="id" value={editing.id} />}

            {/* Name */}
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

            {/* Slug + Provider Type */}
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
                  onValueChange={handleProviderTypeChange}
                >
                  <SelectTrigger id="provType" data-testid="provider-type-select">
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

            {/* API Key with reveal + validate */}
            <div>
              <Label htmlFor="provApiKey">API Key</Label>
              <div className="relative">
                <Input
                  id="provApiKey"
                  name="apiKey"
                  type={showApiKey ? "text" : "password"}
                  value={displayKey}
                  onChange={(e) => {
                    setApiKeyValue(e.target.value);
                    setKeyValidation(null);
                    setDecryptedKey(null);
                  }}
                  placeholder={
                    editing?.hasApiKey
                      ? "Dejar vacío para no cambiar"
                      : "Introduce la API key"
                  }
                  autoComplete="off"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={handleToggleShowKey}
                  disabled={loadingDecrypt}
                  data-testid="toggle-api-key"
                >
                  {loadingDecrypt ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : showApiKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleValidateKey}
                  disabled={
                    validatingKey || (!apiKeyValue && !decryptedKey)
                  }
                  data-testid="validate-key-btn"
                >
                  {validatingKey ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : null}
                  Validar Key
                </Button>
                {keyValidation && (
                  <span
                    className={`text-xs flex items-center gap-1 ${
                      keyValidation.valid
                        ? "text-emerald-600"
                        : "text-destructive"
                    }`}
                    data-testid="key-validation-result"
                  >
                    {keyValidation.valid ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5" />
                    )}
                    {keyValidation.valid
                      ? "Key válida"
                      : keyValidation.detail || "Key inválida"}
                  </span>
                )}
              </div>
            </div>

            {/* Base URL — auto-filled per provider */}
            <div>
              <Label htmlFor="provBaseUrl">Base URL</Label>
              <Input
                id="provBaseUrl"
                name="baseUrl"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={getBaseUrlForProvider(providerType)}
              />
            </div>

            {/* Model selector dropdown */}
            <div>
              <Label htmlFor="provModel">Modelo por defecto</Label>
              <Select
                name="model"
                value={selectedModel}
                onValueChange={handleModelSelect}
              >
                <SelectTrigger id="provModel" data-testid="model-select">
                  <SelectValue placeholder="Seleccionar modelo..." />
                </SelectTrigger>
                <SelectContent>
                  {currentModels.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} — {formatModelPrice(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Cost fields — auto-filled from model, editable */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="costInput">Coste/1K tokens (input)</Label>
                <Input
                  id="costInput"
                  name="costPer1kInput"
                  type="number"
                  step="0.0001"
                  min="0"
                  value={costInput}
                  onChange={(e) => setCostInput(e.target.value)}
                  data-testid="cost-input"
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
                  value={costOutput}
                  onChange={(e) => setCostOutput(e.target.value)}
                  data-testid="cost-output"
                />
              </div>
            </div>

            {/* Provider change warning */}
            {editing &&
              previousProviderType &&
              providerType !== previousProviderType && (
                <div className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>
                    Has cambiado el tipo de proveedor. La API key anterior no
                    será válida — introduce una nueva key para{" "}
                    {getProviderLabel(providerType)}.
                  </span>
                </div>
              )}

            {/* Active toggle */}
            <div className="flex items-center gap-2">
              <Switch
                id="provActive"
                name="isActive"
                defaultChecked={editing?.isActive ?? true}
                value="true"
              />
              <Label htmlFor="provActive">Activo</Label>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                )}
                {editing ? "Guardar Cambios" : "Crear Proveedor"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
