export function getRoleHome(role: string): string {
  if (role === "admin") return "/dashboard";
  if (role === "rider") return "/rider-deliveries";
  if (role === "cashier") return "/staff-dashboard";
  if (role === "baker") return "/baker-dashboard";
  return "/staff-dashboard";
}
