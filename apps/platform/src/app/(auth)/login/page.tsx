"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, User, Eye, EyeOff, AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import Image from "next/image";

// Generate deterministic particle data at module level so it's stable across renders
const PARTICLES = Array.from({ length: 28 }, (_, i) => ({
  left: `${(i * 37 + 13) % 100}%`,
  bottom: `-${(i * 7) % 10}%`,
  width: `${1 + ((i * 3) % 3)}px`,
  height: `${1 + ((i * 3) % 3)}px`,
  opacity: 0.3 + ((i * 13) % 5) * 0.1,
  duration: `${10 + ((i * 7) % 16)}s`,
  delay: `${((i * 3) % 15)}s`,
}));

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password.trim()) {
      setError("Por favor, completa todos los campos");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      if (!res.ok) {
        const data: { error?: string } = await res.json();
        setError(data.error ?? "Error al iniciar sesión");
        setLoading(false);
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("Error de conexión. Inténtalo de nuevo.");
      setLoading(false);
    }
  }

  return (
    <div className="login-bg min-h-screen flex items-center justify-center p-4">
      {/* Grid pattern overlay */}
      <div className="fixed inset-0 login-grid-pattern pointer-events-none" />

      {/* Animated particles — 28 like CHS */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {PARTICLES.map((p, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              left: p.left,
              bottom: p.bottom,
              width: p.width,
              height: p.height,
              backgroundColor: `rgba(66, 165, 245, ${p.opacity})`,
              animation: `particleFloat ${p.duration} linear infinite`,
              animationDelay: p.delay,
            }}
          />
        ))}
      </div>

      {/* Login card — CHS glass styling */}
      <div
        className="relative z-10 w-full mx-4 animate-fade-in-up"
        style={{ maxWidth: "420px" }}
      >
        <div
          className="rounded-[20px]"
          style={{
            background: "rgba(10, 22, 40, 0.55)",
            backdropFilter: "blur(40px)",
            WebkitBackdropFilter: "blur(40px)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow:
              "0 4px 24px rgba(0,0,0,0.3), 0 0 60px rgba(21,101,192,0.08), inset 0 1px 0 rgba(255,255,255,0.05)",
            padding: "48px clamp(20px, 8vw, 40px) 40px",
          }}
        >
          {/* Logo / Branding */}
          <div className="text-center mb-8">
            <div className="inline-block mb-2">
              <Image
                src="/chs-logo-white.png"
                alt="Centro Hogar Sánchez"
                width={220}
                height={55}
                priority
                className="mx-auto"
              />
            </div>
            {/* Decorative accent line */}
            <div
              className="mx-auto"
              style={{
                width: "40px",
                height: "2px",
                background:
                  "linear-gradient(90deg, transparent, #42A5F5, transparent)",
              }}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username */}
            <div>
              <label htmlFor="username" className="chs-login-label">
                Usuario
              </label>
              <div className="relative">
                <User
                  className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4"
                  style={{ color: "rgba(139, 163, 196, 0.5)" }}
                />
                <input
                  id="username"
                  type="text"
                  name="username"
                  placeholder="Nombre de usuario"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="chs-login-input chs-login-input-icon"
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="chs-login-label">
                Contraseña
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4"
                  style={{ color: "rgba(139, 163, 196, 0.5)" }}
                />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="Contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="chs-login-input chs-login-input-icon chs-login-input-pw"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="chs-eye-toggle"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="chs-login-btn flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Iniciando sesión...
                </>
              ) : (
                <>
                  Iniciar Sesión
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Decorative line */}
          <div
            className="w-full my-6"
            style={{
              height: "1px",
              background:
                "linear-gradient(90deg, transparent, #42A5F5, transparent)",
            }}
          />

          <p className="text-center text-blue-200/30 text-xs">
            CHS Platform &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
