export interface UserDepartment {
  departmentId: string;
  departmentName: string;
  departmentSlug: string;
  departmentIcon: string | null;
  departmentColor: string | null;
  roleId: string;
  roleName: string;
  roleSlug: string;
  permissions?: Record<string, boolean> | null;
}

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar: string | null;
  isActive: boolean;
  isSuperAdmin: boolean;
  lastLogin: string | null;
  departments: UserDepartment[];
}

export interface DepartmentWithApps {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
  description: string | null;
  apps: AppCard[];
}

export interface AppCard {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  category: string | null;
  version: string | null;
  isActive: boolean;
  isMaintenance: boolean;
  status: string;
  externalDomain: string | null;
  accessLevel: string;
}
