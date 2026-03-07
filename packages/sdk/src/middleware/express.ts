import { parseAlephHeaders } from "../parse-headers";
import type { AlephUser } from "../types";

export type { AlephUser };
export { parseAlephHeaders };

interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
  aleph?: AlephUser;
}

interface ResponseLike {
  status: (code: number) => ResponseLike;
  json: (body: Record<string, unknown>) => void;
}

type NextFunction = () => void;

export function alephMiddleware() {
  return (req: RequestLike, _res: ResponseLike, next: NextFunction): void => {
    const user = parseAlephHeaders(req.headers);
    if (user) {
      req.aleph = user;
    }
    next();
  };
}

export function requireAleph() {
  return (req: RequestLike, res: ResponseLike, next: NextFunction): void => {
    if (!req.aleph) {
      res.status(401).json({ error: "Aleph authentication required" });
      return;
    }
    next();
  };
}

export function requireAlephPermission(permission: string) {
  return (req: RequestLike, res: ResponseLike, next: NextFunction): void => {
    if (!req.aleph) {
      res.status(401).json({ error: "Aleph authentication required" });
      return;
    }
    if (!req.aleph.permissions[permission] && req.aleph.role !== "super-admin") {
      res.status(403).json({ error: `Permission '${permission}' required` });
      return;
    }
    next();
  };
}

export function requireAlephAccessLevel(level: "full" | "readonly") {
  return (req: RequestLike, res: ResponseLike, next: NextFunction): void => {
    if (!req.aleph) {
      res.status(401).json({ error: "Aleph authentication required" });
      return;
    }
    if (level === "full" && req.aleph.accessLevel !== "full") {
      res.status(403).json({ error: "Full access required" });
      return;
    }
    next();
  };
}
