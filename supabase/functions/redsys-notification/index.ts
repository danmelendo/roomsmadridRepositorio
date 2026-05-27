/**
 * redsys-notification  (server-to-server webhook)
 *
 * Redsys POSTs here after every transaction attempt.
 * We verify the HMAC_SHA256_V1 signature, and on success we mark the
 * reservation deposit as paid and send the confirmation email.
 *
 * Register this URL in your Redsys merchant panel as "URL de notificación".
 * It must be publicly reachable (Supabase Edge Function URL is fine).
 *
 * Environment variables required:
 *   REDSYS_SECRET_KEY   Base64-encoded secret key (same as in create-redsys-payment)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Buffer } from "node:buffer";
import { createCipheriv, createHmac } from "node:crypto";

function redsysSignature(secretKeyB64: string, order: string, merchantParamsB64: string): string {
  const key = Buffer.from(secretKeyB64, "base64");
  const orderBuf = Buffer.alloc(8);
  Buffer.from(order, "ascii").copy(orderBuf, 0, 0, Math.min(order.length, 8));
  const cipher = createCipheriv("des-ede3-cbc", key, Buffer.alloc(8));
  cipher.setAutoPadding(false);
  const derivedKey = Buffer.concat([cipher.update(orderBuf), cipher.final()]);
  return createHmac("sha256", derivedKey).update(merchantParamsB64).digest("base64");
}

/** Normalise base64 so + and - / _ variants compare equal */
function normaliseB64(s: string) {
  return s.replace(/[-_]/g, (c) => (c === "-" ? "+" : "/")).replace(/=*$/, "");
}

Deno.serve(async (req) => {
  // Redsys sends application/x-www-form-urlencoded
  let body: string;
  try {
    body = await req.text();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const params = new URLSearchParams(body);
  const signatureVersion = params.get("Ds_SignatureVersion");
  const merchantParamsB64 = params.get("Ds_MerchantParameters");
  const receivedSig = params.get("Ds_Signature");

  if (signatureVersion !== "HMAC_SHA256_V1" || !merchantParamsB64 || !receivedSig) {
    console.error("redsys-notification: missing or unknown signature version");
    return new Response("Bad request", { status: 400 });
  }

  // Decode merchant params
  let merchantParams: Record<string, string>;
  try {
    merchantParams = JSON.parse(atob(merchantParamsB64));
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const order = merchantParams.Ds_Order;
  const responseCode = parseInt(merchantParams.Ds_Response ?? "9999", 10);

  if (!order) {
    console.error("redsys-notification: missing Ds_Order");
    return new Response("Bad request", { status: 400 });
  }

  // ── Verify signature ────────────────────────────────────────────────────
  const secretKey = Deno.env.get("REDSYS_SECRET_KEY")!;
  const expectedSig = redsysSignature(secretKey, order, merchantParamsB64);

  if (normaliseB64(expectedSig) !== normaliseB64(receivedSig)) {
    console.error("redsys-notification: signature mismatch for order", order);
    return new Response("Forbidden", { status: 403 });
  }

  // ── Update DB ──────────────────────────────────────────────────────────
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Response codes 0–99 = authorised; anything else = error/refused
  const authorised = responseCode >= 0 && responseCode <= 99;
  console.log(`redsys-notification: order=${order} code=${responseCode} authorised=${authorised}`);

  if (authorised) {
    const amountCents = parseInt(merchantParams.Ds_Amount ?? "0", 10);
    const paidAmount = amountCents / 100;

    const { data: reservation, error: findErr } = await supabase
      .from("reservations")
      .select("id, deposit_paid")
      .eq("redsys_order", order)
      .maybeSingle();

    if (findErr || !reservation) {
      console.error("redsys-notification: reservation not found for order", order);
      // Return 200 so Redsys doesn't keep retrying for a known bad state
      return new Response("OK");
    }

    if (!reservation.deposit_paid) {
      await supabase.from("reservations").update({
        deposit_paid: true,
        paid_amount: paidAmount,
      }).eq("id", reservation.id);

      // Trigger confirmation email
      try {
        await supabase.functions.invoke("send-reservation-confirmation", {
          body: { reservation_id: reservation.id },
        });
      } catch (e) {
        console.warn("redsys-notification: email send failed", e);
      }
    }
  }

  // Redsys expects a 200 response with any body to acknowledge receipt
  return new Response("OK");
});
