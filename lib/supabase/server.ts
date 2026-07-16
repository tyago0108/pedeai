import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function getSupabaseAdmin() {
  if (!url || !serviceRoleKey) {
    throw new Error("Configure SUPABASE_SERVICE_ROLE_KEY no .env.local do servidor.");
  }
  return createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function requirePlatformAdmin(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Não autenticado.");
  const admin = getSupabaseAdmin();
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) throw new Error("Sessão inválida.");
  const { data: role } = await admin.from("administradores_plataforma").select("id").eq("id", userData.user.id).maybeSingle();
  if (!role) throw new Error("Sem permissão de plataforma.");
  return { admin, user: userData.user };
}
