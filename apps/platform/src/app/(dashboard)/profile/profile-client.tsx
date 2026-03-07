"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { User, Lock, Settings, Mail, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { updateProfile, changePassword } from "@/lib/actions/profile";
import { getInitials, formatRelativeTime } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import type { AuthUser } from "@/lib/types";

interface ProfileClientProps {
  user: AuthUser;
}

export function ProfileClient({ user }: ProfileClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  async function handleUpdateProfile(formData: FormData) {
    setSaving(true);
    const result = await updateProfile(formData);
    setSaving(false);
    if (result.success) {
      toast({ title: "Perfil actualizado exitosamente" });
      router.refresh();
    } else {
      toast({ title: result.error ?? "Error", variant: "destructive" });
    }
  }

  async function handleChangePassword(formData: FormData) {
    setChangingPassword(true);
    const result = await changePassword(formData);
    setChangingPassword(false);
    if (result.success) {
      toast({ title: "Contraseña cambiada exitosamente" });
    } else {
      toast({ title: result.error ?? "Error", variant: "destructive" });
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Mi Perfil</h1>

      <div className="space-y-6">
        {/* Personal data */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-3 mb-4">
            <User className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Datos personales</h2>
          </div>
          <form action={handleUpdateProfile} className="space-y-4">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-bold">
                {getInitials(user.firstName, user.lastName)}
              </div>
              <div>
                <p className="font-medium text-lg">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-sm text-muted-foreground">@{user.username}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">Nombre</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  defaultValue={user.firstName}
                  required
                />
              </div>
              <div>
                <Label htmlFor="lastName">Apellido</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  defaultValue={user.lastName}
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={user.email}
                required
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando..." : "Guardar cambios"}
              </Button>
            </div>
          </form>
        </div>

        {/* Account info */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-3 mb-4">
            <Mail className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Información de cuenta</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Username</p>
              <p className="font-medium">{user.username}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Email</p>
              <p className="font-medium">{user.email}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Último acceso</p>
              <p className="font-medium">
                {user.lastLogin ? formatRelativeTime(user.lastLogin) : "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Departamento</p>
              <p className="font-medium">
                {user.departments[0]?.departmentName ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Rol</p>
              <p className="font-medium">
                {user.departments[0]?.roleName ?? "—"}
                {user.isSuperAdmin && " (Super Admin)"}
              </p>
            </div>
          </div>
        </div>

        {/* Change password */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-3 mb-4">
            <Lock className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Cambiar contraseña</h2>
          </div>
          <form action={handleChangePassword} className="space-y-4">
            <div>
              <Label htmlFor="currentPassword">Contraseña actual</Label>
              <Input
                id="currentPassword"
                name="currentPassword"
                type="password"
                required
              />
            </div>
            <div>
              <Label htmlFor="newPassword">Nueva contraseña</Label>
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                minLength={8}
                required
              />
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                minLength={8}
                required
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={changingPassword}>
                {changingPassword ? "Cambiando..." : "Cambiar contraseña"}
              </Button>
            </div>
          </form>
        </div>

        {/* Preferences */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-3 mb-4">
            <Settings className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Preferencias</h2>
          </div>
          <div className="space-y-4">
            <div>
              <Label>Tema</Label>
              <div className="flex gap-2 mt-2">
                {[
                  { value: "light", label: "Claro" },
                  { value: "dark", label: "Oscuro" },
                  { value: "system", label: "Sistema" },
                ].map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTheme(t.value)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      theme === t.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
