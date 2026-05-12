export function getToken(): string | null {
  return localStorage.getItem("bakery_token");
}

export function setToken(token: string): void {
  localStorage.setItem("bakery_token", token);
}

export function removeToken(): void {
  localStorage.removeItem("bakery_token");
  localStorage.removeItem("bakery_user");
}

export interface AuthUser {
  id: number;
  username: string;
  name: string;
  role: "admin" | "staff" | "cashier" | "baker" | "rider";
  jobTitle?: string | null;
  employeeId?: number | null;
}

export function getUser(): AuthUser | null {
  const raw = localStorage.getItem("bakery_user");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function setUser(user: AuthUser): void {
  localStorage.setItem("bakery_user", JSON.stringify(user));
}

export function formatUGX(amount: number): string {
  return `UGX ${amount.toLocaleString("en-UG")}`;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-UG", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-UG", { hour: "2-digit", minute: "2-digit" });
}

export function formatDateTime(dateStr: string): string {
  return `${formatDate(dateStr)}, ${formatTime(dateStr)}`;
}
