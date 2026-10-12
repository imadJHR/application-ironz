export type AccessRole = "ADMIN" | "COMMERCIAL" | "COMPTABILITE";
export type Permission = "read" | "sales" | "invoice" | "finance" | "admin";

export function allowed(role: AccessRole, permission: Permission) {
  if (permission === "read") return true;
  if (role === "ADMIN") return true;
  switch (permission) {
    case "sales":
      return role === "COMMERCIAL";
    case "invoice":
      return role === "COMMERCIAL" || role === "COMPTABILITE";
    case "finance":
      return role === "COMPTABILITE";
    case "admin":
      return false;
  }
}
