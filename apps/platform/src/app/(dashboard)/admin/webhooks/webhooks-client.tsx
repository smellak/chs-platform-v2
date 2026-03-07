"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  createWebhook,
  updateWebhook,
  toggleWebhook,
  deleteWebhook,
  testWebhook,
} from "@/lib/actions/webhooks";
import { useToast } from "@/components/ui/use-toast";
import { formatRelativeTime } from "@/lib/utils";

const AVAILABLE_EVENTS = [
  { id: "app.down", label: "Servicio caído" },
  { id: "app.up", label: "Servicio restaurado" },
  { id: "user.created", label: "Usuario creado" },
  { id: "user.deactivated", label: "Usuario desactivado" },
  { id: "access.granted", label: "Acceso concedido" },
  { id: "access.revoked", label: "Acceso revocado" },
  { id: "auth.login", label: "Login" },
  { id: "app.maintenance.on", label: "Mantenimiento activado" },
  { id: "app.maintenance.off", label: "Mantenimiento desactivado" },
];

interface WebhookRow {
  id: string;
  name: string;
  url: string;
  events: unknown;
  isActive: boolean;
  lastTriggered: Date | null;
  lastStatus: number | null;
  failCount: number;
  createdAt: Date;
}

interface WebhooksClientProps {
  webhooks: WebhookRow[];
}

export function WebhooksClient({ webhooks }: WebhooksClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WebhookRow | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);

  function openCreate() {
    setEditing(null);
    setSelectedEvents([]);
    setDialogOpen(true);
  }

  function openEdit(hook: WebhookRow) {
    setEditing(hook);
    setSelectedEvents((hook.events as string[]) ?? []);
    setDialogOpen(true);
  }

  function toggleEvent(eventId: string) {
    setSelectedEvents((prev) =>
      prev.includes(eventId)
        ? prev.filter((e) => e !== eventId)
        : [...prev, eventId],
    );
  }

  async function handleSubmit(formData: FormData) {
    for (const event of selectedEvents) {
      formData.append("events", event);
    }

    const result = editing
      ? await updateWebhook(formData)
      : await createWebhook(formData);

    if (result.success) {
      toast({
        title: editing ? "Webhook actualizado" : "Webhook creado exitosamente",
      });
      setDialogOpen(false);
      router.refresh();
    } else {
      toast({ title: result.error ?? "Error", variant: "destructive" });
    }
  }

  async function handleToggle(id: string, isActive: boolean) {
    const result = await toggleWebhook(id, !isActive);
    if (result.success) {
      router.refresh();
    }
  }

  async function handleDelete(id: string) {
    const result = await deleteWebhook(id);
    if (result.success) {
      toast({ title: "Webhook eliminado" });
      router.refresh();
    }
  }

  async function handleTest(id: string) {
    const result = await testWebhook(id);
    toast({
      title: result.success ? "Test enviado correctamente" : "Error al enviar test",
      variant: result.success ? "default" : "destructive",
    });
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Webhooks</h1>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Webhook
        </Button>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead className="hidden md:table-cell">URL</TableHead>
              <TableHead className="hidden lg:table-cell">Eventos</TableHead>
              <TableHead className="hidden sm:table-cell">Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {webhooks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No hay webhooks configurados
                </TableCell>
              </TableRow>
            ) : (
              webhooks.map((hook) => {
                const events = (hook.events as string[]) ?? [];
                return (
                  <TableRow key={hook.id}>
                    <TableCell className="font-medium">{hook.name}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-[200px] truncate">
                      {hook.url}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className="text-xs text-muted-foreground">
                        {events.length} evento{events.length !== 1 ? "s" : ""}
                      </span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant={hook.isActive ? "success" : "destructive"}>
                        {hook.isActive ? "Activo" : "Inactivo"}
                      </Badge>
                      {hook.lastTriggered && (
                        <span className="text-xs text-muted-foreground ml-2">
                          {formatRelativeTime(hook.lastTriggered)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTest(hook.id)}
                        >
                          Probar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(hook)}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggle(hook.id, hook.isActive)}
                        >
                          {hook.isActive ? "Desactivar" : "Activar"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(hook.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar Webhook" : "Nuevo Webhook"}
            </DialogTitle>
          </DialogHeader>
          <form action={handleSubmit} className="space-y-4">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div>
              <Label htmlFor="hookName">Nombre</Label>
              <Input
                id="hookName"
                name="name"
                defaultValue={editing?.name ?? ""}
                required
              />
            </div>
            <div>
              <Label htmlFor="hookUrl">URL</Label>
              <Input
                id="hookUrl"
                name="url"
                type="url"
                placeholder="https://example.com/webhook"
                defaultValue={editing?.url ?? ""}
                required
              />
            </div>
            <div>
              <Label>Eventos</Label>
              <div className="grid grid-cols-1 gap-2 mt-2">
                {AVAILABLE_EVENTS.map((ev) => (
                  <div key={ev.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`event-${ev.id}`}
                      checked={selectedEvents.includes(ev.id)}
                      onCheckedChange={() => toggleEvent(ev.id)}
                    />
                    <label
                      htmlFor={`event-${ev.id}`}
                      className="text-sm cursor-pointer"
                    >
                      {ev.label}{" "}
                      <span className="text-xs text-muted-foreground">
                        ({ev.id})
                      </span>
                    </label>
                  </div>
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
                {editing ? "Guardar Cambios" : "Crear Webhook"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
