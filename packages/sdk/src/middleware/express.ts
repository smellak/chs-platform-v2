import { parseCHSHeaders } from "../parse-headers";
import type { CHSUser } from "../types";

export type { CHSUser };
export { parseCHSHeaders };

interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
  chs?: CHSUser;
}

interface ResponseLike {
  status: (code: number) => ResponseLike;
  json: (body: Record<string, unknown>) => void;
}

type NextFunction = () => void;

export function chsMiddleware() {
  return (req: RequestLike, _res: ResponseLike, next: NextFunction): void => {
    const user = parseCHSHeaders(req.headers);
    if (user) {
      req.chs = user;
    }
    next();
  };
}

export function requireCHS() {
  return (req: RequestLike, res: ResponseLike, next: NextFunction): void => {
    if (!req.chs) {
      res.status(401).json({ error: "CHS authentication required" });
      return;
    }
    next();
  };
}

export function requireCHSPermission(permission: string) {
  return (req: RequestLike, res: ResponseLike, next: NextFunction): void => {
    if (!req.chs) {
      res.status(401).json({ error: "CHS authentication required" });
      return;
    }
    if (!req.chs.permissions[permission] && req.chs.role !== "super-admin") {
      res.status(403).json({ error: `Permission '${permission}' required` });
      return;
    }
    next();
  };
}

export function requireCHSAccessLevel(level: "full" | "readonly") {
  return (req: RequestLike, res: ResponseLike, next: NextFunction): void => {
    if (!req.chs) {
      res.status(401).json({ error: "CHS authentication required" });
      return;
    }
    if (level === "full" && req.chs.accessLevel !== "full") {
      res.status(403).json({ error: "Full access required" });
      return;
    }
    next();
  };
}
