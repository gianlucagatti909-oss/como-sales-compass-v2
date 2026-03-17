export type UserRole = "admin" | "rappresentante";

export interface UserProfile {
  id: string;
  username: string;
  password: string; // plain text for local-only demo
  role: UserRole;
  rappresentante?: string; // linked representative name from CSV
  displayName: string;
  enabled: boolean;
}

export interface AuthState {
  currentUserId: string | null;
  users: UserProfile[];
}
