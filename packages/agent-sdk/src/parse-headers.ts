import type { AlephUser } from "./types";

export function parseAlephHeaders(headers: Record<string, string | string[] | undefined>): AlephUser | null {
  const get = (name: string): string | undefined => {
    const val = headers[name] ?? headers[name.toLowerCase()];
    return typeof val === "string" ? val : Array.isArray(val) ? val[0] : undefined;
  };

  const id = get("x-aleph-user-id") ?? get("X-Aleph-User-Id");
  const name = get("x-aleph-user-name") ?? get("X-Aleph-User-Name");
  const email = get("x-aleph-user-email") ?? get("X-Aleph-User-Email");
  const role = get("x-aleph-role") ?? get("X-Aleph-Role");
  const accessLevel = get("x-aleph-access-level") ?? get("X-Aleph-Access-Level");

  if (!id || !name || !email || !role || !accessLevel) return null;

  return {
    id,
    name,
    email,
    role,
    accessLevel,
    orgId: get("x-aleph-org-id") ?? get("X-Aleph-Org-Id"),
    department: get("x-aleph-dept") ?? get("X-Aleph-Dept"),
  };
}
