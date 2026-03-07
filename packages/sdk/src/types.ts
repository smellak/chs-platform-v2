export interface AlephUser {
  id: string;
  name: string;
  email: string;
  orgId: string;
  orgName: string;
  dept: string;
  deptId: string;
  role: "super-admin" | "dept-admin" | "user" | "viewer";
  accessLevel: "full" | "readonly";
  permissions: Record<string, boolean>;
}

export interface AlephHeaders {
  "x-aleph-user-id": string;
  "x-aleph-user-name": string;
  "x-aleph-user-email": string;
  "x-aleph-org-id": string;
  "x-aleph-org-name": string;
  "x-aleph-dept": string;
  "x-aleph-dept-id": string;
  "x-aleph-role": string;
  "x-aleph-access-level": string;
  "x-aleph-permissions": string;
}
