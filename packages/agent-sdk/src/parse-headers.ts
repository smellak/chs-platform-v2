import type { CHSUser } from "./types";

export function parseCHSHeaders(headers: Record<string, string | string[] | undefined>): CHSUser | null {
  const get = (name: string): string | undefined => {
    const val = headers[name] ?? headers[name.toLowerCase()];
    return typeof val === "string" ? val : Array.isArray(val) ? val[0] : undefined;
  };

  const id = get("x-chs-user-id") ?? get("X-CHS-User-Id");
  const name = get("x-chs-user-name") ?? get("X-CHS-User-Name");
  const email = get("x-chs-user-email") ?? get("X-CHS-User-Email");
  const role = get("x-chs-role") ?? get("X-CHS-Role");
  const accessLevel = get("x-chs-access-level") ?? get("X-CHS-Access-Level");

  if (!id || !name || !email || !role || !accessLevel) return null;

  return {
    id,
    name,
    email,
    role,
    accessLevel,
    orgId: get("x-chs-org-id") ?? get("X-CHS-Org-Id"),
    department: get("x-chs-dept") ?? get("X-CHS-Dept"),
  };
}
