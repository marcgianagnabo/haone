import { handleSupabaseError, supabase } from "./common";

export interface EmailBlastRecipient {
  id: string;
  email: string;
  name: string;
  fields: Record<string, string>;
  selected: boolean;
  sendStatus: "ready" | "sent" | "failed";
  sendError?: string;
}

export interface EmailBlastDraft {
  id: string;
  creatorId: string;
  name: string;
  source: "haone" | "csv";
  subject: string;
  bodyHtml: string;
  recipients: EmailBlastRecipient[];
  updatedAt: string;
}

function mapDraft(row: any): EmailBlastDraft {
  return {
    id: row.id,
    creatorId: row.creator_id,
    name: row.name || "",
    source: row.source === "csv" ? "csv" : "haone",
    subject: row.subject || "",
    bodyHtml: row.body_html || "",
    recipients: Array.isArray(row.recipients) ? row.recipients : [],
    updatedAt: row.updated_at
  };
}

export async function listEmailBlastDrafts(): Promise<EmailBlastDraft[]> {
  if (!supabase) throw new Error("Supabase is not configured in this HAOne environment.");
  const { data, error } = await supabase
    .from("email_blast_campaigns")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) handleSupabaseError(error);
  return (data || []).map(mapDraft);
}

export async function saveEmailBlastDraft(draft: EmailBlastDraft): Promise<EmailBlastDraft> {
  if (!supabase) throw new Error("Supabase is not configured in this HAOne environment.");
  const { data, error } = await supabase
    .from("email_blast_campaigns")
    .upsert(
      {
        id: draft.id,
        creator_id: draft.creatorId,
        name: draft.name,
        source: draft.source,
        subject: draft.subject,
        body_html: draft.bodyHtml,
        recipients: draft.recipients,
        updated_at: new Date().toISOString()
      },
      { onConflict: "id" }
    )
    .select("*")
    .single();
  if (error) handleSupabaseError(error);
  return mapDraft(data);
}
