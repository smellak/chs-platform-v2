import type { AlephUser } from "./types";

export function parseAlephHeaders(
  headers: Record<string, string | string[] | undefined>,
): AlephUser | null {
  const get = (name: string): string | undefined => {
    const val = headers[name] ?? headers[name.toLowerCase()];
    return Array.isArray(val) ? val[0] : val;
  };

  const id = get("x-aleph-user-id");
  if (!id) return null;

  return {
    id,
    name: get("x-aleph-user-name") ?? "",
    email: get("x-aleph-user-email") ?? "",
    orgId: get("x-aleph-org-id") ?? "",
    orgName: get("x-aleph-org-name") ?? "",
    dept: get("x-aleph-dept") ?? "",
    deptId: get("x-aleph-dept-id") ?? "",
    role: (get("x-aleph-role") as AlephUser["role"]) ?? "viewer",
    accessLevel: (get("x-aleph-access-level") as AlephUser["accessLevel"]) ?? "readonly",
    permissions: parsePermissions(get("x-aleph-permissions")),
  };
}

function parsePermissions(raw: string | undefined): Record<string, boolean> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    return {};
  }
}
