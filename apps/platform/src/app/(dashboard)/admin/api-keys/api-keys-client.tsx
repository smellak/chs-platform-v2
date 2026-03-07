"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Copy, Check } from "lucide-react";
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
import { revokeApiKey } from "@/lib/actions/api-keys";
import { useToast } from "@/components/ui/use-toast";
import { formatRelativeTime } from "@/lib/utils";

interface ApiKeyRow {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsed: Date | null;
  expiresAt: Date | null;
  isActive: boolean;
  createdAt: Date;
}

interface ApiKeysClientProps {
  keys: ApiKeyRow[];
}

export function ApiKeysClient({ keys }: ApiKeysClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  async function handleCreate() {
    const name = nameRef.current?.value?.trim() ?? "";
    if (!name) return;
    setCreating(true);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const result = (await res.json()) as { success?: boolean; key?: string; error?: string };
      if (result.success && result.key) {
        setGeneratedKey(result.key);
        toast({ title: "Clave API creada exitosamente" });
        router.refresh();
      } else {
        toast({ title: result.error ?? "Error al crear clave", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error de conexión", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(keyId: string) {
    const result = await revokeApiKey(keyId);
    if (result.success) {
      toast({ title: "Clave API revocada" });
      router.refresh();
    } else {
      toast({ title: result.error ?? "Error", variant: "destructive" });
    }
  }

  function copyKey() {
    if (generatedKey) {
      void navigator.clipboard.writeText(generatedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Claves API</h1>
        <Button
          onClick={() => {
            setGeneratedKey(null);
            setCopied(false);
            setDialogOpen(true);
          }}
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nueva Clave API
        </Button>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Prefijo</TableHead>
              <TableHead className="hidden md:table-cell">Último uso</TableHead>
              <TableHead className="hidden sm:table-cell">Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {keys.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No hay claves API
                </TableCell>
              </TableRow>
            ) : (
              keys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="font-medium">{key.name}</TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {key.keyPrefix}...
                    </code>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {key.lastUsed ? formatRelativeTime(key.lastUsed) : "Nunca"}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant={key.isActive ? "success" : "destructive"}>
                      {key.isActive ? "Activa" : "Revocada"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {key.isActive && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevoke(key.id)}
                      >
                        Revocar
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {generatedKey ? "Clave API generada" : "Nueva Clave API"}
            </DialogTitle>
          </DialogHeader>

          {generatedKey ? (
            <div className="space-y-4">
              <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                Esta clave solo se mostrará una vez. Cópiala ahora.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-muted p-3 rounded break-all">
                  {generatedKey}
                </code>
                <Button variant="outline" size="sm" onClick={copyKey}>
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => setDialogOpen(false)}>Cerrar</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label htmlFor="keyName">Nombre</Label>
                <Input
                  id="keyName"
                  name="name"
                  ref={nameRef}
                  placeholder="Mi clave de integración"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  disabled={creating}
                  onClick={handleCreate}
                >
                  {creating ? "Creando..." : "Crear Clave"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
