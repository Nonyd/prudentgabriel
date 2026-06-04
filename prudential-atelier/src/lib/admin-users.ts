import { Role } from "@prisma/client";

export const MANAGED_STAFF_ROLES: Role[] = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.STAFF_ADMIN,
  Role.BESPOKE_MANAGER,
  Role.RTW_MANAGER,
  Role.CONTENT_MANAGER,
  Role.FINANCE_MANAGER,
  Role.HR_MANAGER,
  Role.CONSULTATION_MANAGER,
  Role.STAFF,
];

export const INVITE_ROLES: Role[] = [
  Role.ADMIN,
  Role.STAFF_ADMIN,
  Role.BESPOKE_MANAGER,
  Role.RTW_MANAGER,
  Role.CONTENT_MANAGER,
  Role.FINANCE_MANAGER,
  Role.HR_MANAGER,
  Role.CONSULTATION_MANAGER,
  Role.STAFF,
];

export const INVITE_ROLE_LABELS: Record<string, string> = {
  ADMIN: "General Admin",
  STAFF_ADMIN: "Restricted Admin",
  BESPOKE_MANAGER: "Bespoke Manager",
  RTW_MANAGER: "RTW Manager",
  CONTENT_MANAGER: "Content Manager",
  FINANCE_MANAGER: "Finance Manager",
  HR_MANAGER: "HR Manager",
  CONSULTATION_MANAGER: "Consultation Manager",
  STAFF: "Staff",
};

export type RoleBadgeVariant = "wine" | "gold" | "success" | "grey" | "outline-gold" | "outline-wine" | "accent";

export function roleBadgeVariant(role: string): RoleBadgeVariant {
  switch (role) {
    case "SUPER_ADMIN":
      return "wine";
    case "ADMIN":
      return "gold";
    case "STAFF_ADMIN":
      return "outline-gold";
    case "BESPOKE_MANAGER":
    case "RTW_MANAGER":
    case "CONTENT_MANAGER":
    case "FINANCE_MANAGER":
    case "HR_MANAGER":
    case "CONSULTATION_MANAGER":
      return "accent";
    case "STAFF":
      return "grey";
    default:
      return "grey";
  }
}

export function displayRoleLabel(role: string): string {
  if (role === "SUPER_ADMIN") return "Super Admin";
  return INVITE_ROLE_LABELS[role] ?? role.replace(/_/g, " ");
}
