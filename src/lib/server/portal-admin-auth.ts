import { authenticateAdmin } from "$api/services/auth-service";
import { INSTANCE_ADMIN } from "$env/static/private";
import { PUBLIC_SUPABASE_PUBLISHABLE_KEY, PUBLIC_SUPABASE_URL } from "$env/static/public";
import { createClient } from "@supabase/supabase-js";
import { json } from "@sveltejs/kit";

function requestWithCredentialFallback(request: Request): Request {
  if (request.headers.get("Authorization")) return request;
  const credential = request.headers.get("x-haone-credential");
  if (!credential) return request;
  const headers = new Headers(request.headers);
  headers.set("Authorization", `Bearer ${credential}`);
  return new Request(request.url, { method: "GET", headers });
}

export async function authenticatePortalAdmin(request: Request) {
  const primary = await authenticateAdmin(requestWithCredentialFallback(request));
  if (!primary.error || primary.error.status !== 401) return primary;

  const token = request.headers.get("x-supabase-access-token");
  if (!token || !PUBLIC_SUPABASE_URL || !PUBLIC_SUPABASE_PUBLISHABLE_KEY) return primary;

  const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
  const { data, error } = await supabase.auth.getUser(token);
  const email = data.user?.email?.trim().toLowerCase();
  if (error || !data.user || !email) return primary;

  const isInstanceAdmin = email === (INSTANCE_ADMIN || "").trim().toLowerCase();
  if (!isInstanceAdmin) {
    const { data: officer, error: officerError } = await supabase
      .from("officers")
      .select("id")
      .ilike("email", email)
      .eq("status", "ACTIVE")
      .maybeSingle();
    if (officerError || !officer) {
      return { error: json({ error: "Forbidden: Admin access required" }, { status: 403 }) };
    }
  }

  return { email, residentId: data.user.id, isInstanceAdmin };
}
