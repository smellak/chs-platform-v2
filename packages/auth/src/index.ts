import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AlephTokenPayload {
  userId: string;
  orgId: string;
  iat: number;
  exp: number;
}

export interface CookieConfig {
  name: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax" | "strict" | "none";
  path: string;
  maxAge: number;
  domain?: string;
}

interface JwtPayload {
  userId: string;
  orgId: string;
}

// ─── Password Functions ──────────────────────────────────────────────────────

const SALT_ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ─── JWT Functions ───────────────────────────────────────────────────────────

function getJwtSecret(): string {
  const secret = process.env["JWT_SECRET"];
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is required");
  }
  return secret;
}

const ACCESS_TOKEN_EXPIRY = "15m";

export function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: ACCESS_TOKEN_EXPIRY,
    algorithm: "HS256",
  });
}

export function verifyAccessToken(token: string): AlephTokenPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret(), {
      algorithms: ["HS256"],
    });
    if (
      typeof decoded === "object" &&
      decoded !== null &&
      "userId" in decoded &&
      "orgId" in decoded
    ) {
      return decoded as AlephTokenPayload;
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Refresh Token ───────────────────────────────────────────────────────────

export function generateRefreshToken(): string {
  return randomBytes(40).toString("hex");
}

// ─── Cookie Config ───────────────────────────────────────────────────────────

export function getAccessTokenCookieConfig(domain?: string): CookieConfig {
  const config: CookieConfig = {
    name: "aleph_access_token",
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production" && process.env["DOMAIN"] !== "localhost",
    sameSite: "lax",
    path: "/",
    maxAge: 15 * 60,
  };
  if (domain) {
    config.domain = domain;
  }
  return config;
}

export function getRefreshTokenCookieConfig(): CookieConfig {
  return {
    name: "aleph_refresh_token",
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production" && process.env["DOMAIN"] !== "localhost",
    sameSite: "strict",
    path: "/api/auth",
    maxAge: 7 * 24 * 60 * 60,
  };
}

// ─── Token Extractors ────────────────────────────────────────────────────────

export function extractTokenFromHeaders(headers: Headers): string | null {
  const authHeader = headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  const cookieHeader = headers.get("cookie");
  if (cookieHeader) {
    const cookies = cookieHeader.split(";").map((c) => c.trim());
    for (const cookie of cookies) {
      if (cookie.startsWith("aleph_access_token=")) {
        return cookie.slice("aleph_access_token=".length);
      }
    }
  }

  return null;
}
