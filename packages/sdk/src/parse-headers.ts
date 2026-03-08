import type { AlephUser } from "./types";

export function parseAlephHeaders(
  headers: Record<string, string | string[] | undefined>,
): AlephUser | null {
  const get = (name: string): string | undefined => {
    const val = headers[name] ?? headers[name.toLowerCase()];
    return Array.isArray(val) ? val[0] : val;
  };

  const id = get("x-chs-user-id");
  if (!id) return null;

  return {
    id,
    name: get("x-chs-user-name") ?? "",
    email: get("x-chs-user-email") ?? "",
    orgId: get("x-chs-org-id") ?? "",
    orgName: get("x-chs-org-name") ?? "",
    dept: get("x-chs-dept") ?? "",
    deptId: get("x-chs-dept-id") ?? "",
    role: (get("x-chs-role") as AlephUser["role"]) ?? "viewer",
    accessLevel: (get("x-chs-access-level") as AlephUser["accessLevel"]) ?? "readonly",
    permissions: parsePermissions(get("x-chs-permissions")),
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
