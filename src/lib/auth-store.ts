import { AuthState, UserProfile, UserRole } from "@/types/auth";

const AUTH_KEY = "como1907_auth";

const DEFAULT_ADMIN: UserProfile = {
  id: "admin-001",
  username: "admin",
  password: "admin",
  role: "admin",
  displayName: "Sales Manager",
  enabled: true,
};

const GIANLUCA_ADMIN: UserProfile = {
  id: "admin-002",
  username: "gianlucagatti909@gmail.com",
  password: "admin",
  role: "admin",
  displayName: "Gianluca Gatti",
  enabled: true,
};

export function loadAuth(): AuthState {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (raw) {
      const state = JSON.parse(raw) as AuthState;
      if (!state || !Array.isArray(state.users)) {
        throw new Error("Auth state malformed");
      }
      // Ensure default admins always exist
      if (!state.users.some(u => u.id === DEFAULT_ADMIN.id)) {
        state.users.unshift(DEFAULT_ADMIN);
      }
      if (!state.users.some(u => u.id === GIANLUCA_ADMIN.id)) {
        state.users.splice(1, 0, GIANLUCA_ADMIN);
      }
      return state;
    }
  } catch (e) {
    console.error("[auth-store] Dati corrotti, ripristino defaults:", e);
  }
  return { currentUserId: null, users: [DEFAULT_ADMIN, GIANLUCA_ADMIN] };
}

function saveAuth(state: AuthState): void {
  localStorage.setItem(AUTH_KEY, JSON.stringify(state));
}

export function login(username: string, password: string): UserProfile | null {
  const state = loadAuth();
  const user = state.users.find(u => u.username === username && u.password === password && u.enabled);
  if (!user) return null;
  state.currentUserId = user.id;
  saveAuth(state);
  return user;
}

export function logout(): void {
  const state = loadAuth();
  state.currentUserId = null;
  saveAuth(state);
}

export function getCurrentUser(): UserProfile | null {
  const state = loadAuth();
  if (!state.currentUserId) return null;
  return state.users.find(u => u.id === state.currentUserId) ?? null;
}

export function getUsers(): UserProfile[] {
  return loadAuth().users;
}

export function addUser(data: { username: string; password: string; role: UserRole; displayName: string; rappresentante?: string }): UserProfile {
  const state = loadAuth();
  if (state.users.some(u => u.username === data.username)) {
    throw new Error("Username già in uso");
  }
  const user: UserProfile = {
    id: `user-${Date.now()}`,
    ...data,
    enabled: true,
  };
  state.users.push(user);
  saveAuth(state);
  return user;
}

export function updateUser(id: string, updates: Partial<Omit<UserProfile, "id">>): void {
  const state = loadAuth();
  const idx = state.users.findIndex(u => u.id === id);
  if (idx < 0) return;
  // Don't allow disabling the default admin
  if (id === DEFAULT_ADMIN.id && updates.enabled === false) return;
  state.users[idx] = { ...state.users[idx], ...updates };
  saveAuth(state);
}

export function toggleUserEnabled(id: string): void {
  const state = loadAuth();
  const user = state.users.find(u => u.id === id);
  if (!user || id === DEFAULT_ADMIN.id) return;
  user.enabled = !user.enabled;
  saveAuth(state);
}
