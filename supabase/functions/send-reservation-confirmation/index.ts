// Confirmation email for public reservations
// Uses Resend if RESEND_API_KEY is set; otherwise logs and returns ok.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body {
  reservation_id: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { reservation_id } = (await req.json()) as Body;
    if (!reservation_id) throw new Error("reservation_id required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: r, error } = await supabase
      .from("reservations")
      .select("*, rooms(name,building), customers(name,email)")
      .eq("id", reservation_id)
      .maybeSingle();
    if (error) throw error;
    if (!r) throw new Error("Reserva no encontrada");

    const email: string | null = r.customers?.email ?? null;
    if (!email) {
      console.log("No customer email; skipping send");
      return new Response(JSON.stringify({ ok: true, skipped: "no_email" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const start = new Date(r.start_at);
    const end = new Date(r.end_at);
    const fmt = (d: Date) =>
      d.toLocaleString("es-ES", { dateStyle: "full", timeStyle: "short", timeZone: "Europe/Madrid" });
    const total = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(
      Number(r.total ?? 0),
    );

    const html = `
<!doctype html>
<html><body style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; background:#f7f7f8; padding:24px;">
  <div style="max-width:560px; margin:0 auto; background:#fff; border-radius:12px; padding:28px; border:1px solid #eee;">
    <h1 style="margin:0 0 8px; font-size:22px; color:#111;">¡Tu reserva está confirmada!</h1>
    <p style="margin:0 0 20px; color:#555;">Hola ${escapeHtml(r.customers?.name ?? "")}, gracias por reservar con Rooms Madrid.</p>
    <table style="width:100%; border-collapse:collapse; font-size:14px; color:#333;">
      <tr><td style="padding:8px 0; color:#888;">Habitación</td><td style="padding:8px 0; text-align:right;"><strong>${escapeHtml(r.rooms?.building ?? "")} · ${escapeHtml(r.rooms?.name ?? "")}</strong></td></tr>
      <tr><td style="padding:8px 0; color:#888;">Entrada</td><td style="padding:8px 0; text-align:right;">${escapeHtml(fmt(start))}</td></tr>
      <tr><td style="padding:8px 0; color:#888;">Salida</td><td style="padding:8px 0; text-align:right;">${escapeHtml(fmt(end))}</td></tr>
      <tr><td style="padding:8px 0; color:#888;">Personas</td><td style="padding:8px 0; text-align:right;">${r.people}</td></tr>
      <tr><td style="padding:12px 0; color:#888; border-top:1px solid #eee;">Total</td><td style="padding:12px 0; text-align:right; border-top:1px solid #eee;"><strong>${escapeHtml(total)}</strong> <span style="color:#888;">(pago en hotel)</span></td></tr>
    </table>
    <p style="color:#666; font-size:13px; margin-top:24px;">Si necesitas modificar o cancelar tu reserva, contáctanos por teléfono o WhatsApp.</p>
    <p style="color:#aaa; font-size:12px; margin-top:24px;">Rooms Madrid</p>
  </div>
</body></html>`;

    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) {
      console.log("RESEND_API_KEY not set; would send to", email);
      return new Response(JSON.stringify({ ok: true, skipped: "no_api_key" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Rooms Madrid <onboarding@resend.dev>",
        to: [email],
        subject: "Confirmación de tu reserva · Rooms Madrid",
        html,
      }),
    });
    const body = await res.text();
    if (!res.ok) {
      console.error("Resend error", res.status, body);
      throw new Error(`Resend ${res.status}: ${body}`);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
