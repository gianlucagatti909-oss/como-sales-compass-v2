import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabase";
import { UserProfile, UserRole } from "@/types/auth";

const SESSION_KEY = "como1907_session";

function rowToUserProfile(row: Record<string, unknown>): UserProfile {
  return {
    id: row.id as string,
    username: row.username as string,
    password: row.password_hash as string,
    role: row.role as UserRole,
    displayName: row.display_name as string,
    rappresentante: row.rappresentante as string | undefined,
    enabled: row.enabled as boolean,
  };
}

export async function login(username: string, password: string): Promise<UserProfile | null> {
  // Task 37: cleanup legacy localStorage auth key on first successful login
  localStorage.removeItem("como1907_auth");
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("username", username)
    .eq("enabled", true)
    .maybeSingle();

  if (error || !data) return null;

  const hash = data.password_hash as string;
  const valid = await bcrypt.compare(password, hash);
  if (!valid) return null;

  sessionStorage.setItem(SESSION_KEY, data.id as string);
  return rowToUserProfile(data as Record<string, unknown>);
}

export async function logout(): Promise<void> {
  sessionStorage.removeItem(SESSION_KEY);
}

export async function getCurrentUser(): Promise<UserProfile | null> {
  const userId = sessionStorage.getItem(SESSION_KEY);
  if (!userId) return null;

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .eq("enabled", true)
    .maybeSingle();

  if (error || !data) {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }

  return rowToUserProfile(data as Record<string, unknown>);
}

export async function getUsers(): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[auth-store] getUsers error:", error);
    return [];
  }

  return (data ?? []).map(row => rowToUserProfile(row as Record<string, unknown>));
}

export async function addUser(data: {
  username: string;
  password: string;
  role: UserRole;
  displayName: string;
  rappresentante?: string;
}): Promise<UserProfile> {
  const passwordHash = await bcrypt.hash(data.password, 10);

  const { data: inserted, error } = await supabase
    .from("users")
    .insert({
      username: data.username,
      password_hash: passwordHash,
      role: data.role,
      display_name: data.displayName,
      rappresentante: data.rappresentante ?? null,
      enabled: true,
    })
    .select()
    .single();

  if (error) {
    console.error("[auth-store] addUser error:", error);
    if (error.code === "23505") throw new Error("Username già in uso");
    throw new Error("Errore durante la creazione dell'utente");
  }

  return rowToUserProfile(inserted as Record<string, unknown>);
}

export async function updateUser(id: string, updates: Partial<Omit<UserProfile, "id">>): Promise<void> {
  // Don't allow disabling the default admin
  if (updates.enabled === false) {
    const { data } = await supabase.from("users").select("username").eq("id", id).maybeSingle();
    if (data?.username === "admin") return;
  }

  const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.displayName !== undefined) dbUpdates.display_name = updates.displayName;
  if (updates.role !== undefined) dbUpdates.role = updates.role;
  if (updates.rappresentante !== undefined) dbUpdates.rappresentante = updates.rappresentante;
  if (updates.enabled !== undefined) dbUpdates.enabled = updates.enabled;
  if (updates.password !== undefined) {
    dbUpdates.password_hash = await bcrypt.hash(updates.password, 10);
  }

  const { error } = await supabase.from("users").update(dbUpdates).eq("id", id);
  if (error) console.error("[auth-store] updateUser error:", error);
}

export async function toggleUserEnabled(id: string): Promise<void> {
  const { data } = await supabase.from("users").select("username, enabled").eq("id", id).maybeSingle();
  if (!data || data.username === "admin") return;

  const { error } = await supabase
    .from("users")
    .update({ enabled: !data.enabled, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) console.error("[auth-store] toggleUserEnabled error:", error);
}
