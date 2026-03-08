export interface CHSUser {
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

export interface CHSHeaders {
  "x-chs-user-id": string;
  "x-chs-user-name": string;
  "x-chs-user-email": string;
  "x-chs-org-id": string;
  "x-chs-org-name": string;
  "x-chs-dept": string;
  "x-chs-dept-id": string;
  "x-chs-role": string;
  "x-chs-access-level": string;
  "x-chs-permissions": string;
}
