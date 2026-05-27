/**
 * create-redsys-payment
 *
 * Generates the signed form fields required to redirect the browser to
 * the Redsys TPV (HMAC_SHA256_V1 / SHA-256 + 3DES).
 *
 * Environment variables required (set in Supabase Dashboard → Edge Functions → Secrets):
 *   REDSYS_MERCHANT_CODE   Ds_Merchant_MerchantCode  (e.g. "123456789")
 *   REDSYS_TERMINAL        Ds_Merchant_Terminal       (e.g. "001")
 *   REDSYS_SECRET_KEY      Base64-encoded secret key provided by the bank
 *   REDSYS_ENVIRONMENT     "test" | "production"
 *   REDSYS_MERCHANT_URL    Server-to-server notification URL (your webhook endpoint)
 *   REDSYS_URL_OK          Browser redirect URL after successful payment
 *   REDSYS_URL_KO          Browser redirect URL after failed payment
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Buffer } from "node:buffer";
import { createCipheriv, createHmac } from "node:crypto";

// BBVA/Redsys payment endpoints
// Admin portal (test): https://sis-t.redsys.es:25443/portalBBVA
const REDSYS_TEST = "https://sis-t.redsys.es:25443/sis/realizarPago";
const REDSYS_PROD = "https://sis.redsys.es/sis/realizarPago";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

/**
 * Redsys HMAC_SHA256_V1 signature:
 *  1. Derive per-transaction key: 3DES-CBC(secretKey, orderId padded to 8 bytes, IV=0x00…)
 *  2. HMAC-SHA256(merchantParamsBase64, derivedKey) → base64
 */
function redsysSignature(secretKeyB64: string, order: string, merchantParamsB64: string): string {
  const key = Buffer.from(secretKeyB64, "base64");

  // Pad / truncate order to exactly 8 bytes
  const orderBuf = Buffer.alloc(8);
  Buffer.from(order, "ascii").copy(orderBuf, 0, 0, Math.min(order.length, 8));

  // 3DES-CBC, zero IV, no auto-padding (block is already 8 bytes)
  const cipher = createCipheriv("des-ede3-cbc", key, Buffer.alloc(8));
  cipher.setAutoPadding(false);
  const derivedKey = Buffer.concat([cipher.update(orderBuf), cipher.final()]);

  return createHmac("sha256", derivedKey).update(merchantParamsB64).digest("base64");
}

/** Generate a Redsys-valid order number: 4 digits (MMDD) + 8 hex chars from reservation UUID */
function buildOrder(reservationId: string): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hex = reservationId.replace(/-/g, "").slice(0, 8).toUpperCase();
  return `${mm}${dd}${hex}`; // 12 chars, starts with 4 digits
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { reservation_id } = await req.json() as { reservation_id: string };
    if (!reservation_id) return json({ error: "reservation_id required" }, 400);

    // ── Supabase ──────────────────────────────────────────────────────────
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: reservation, error: dbErr } = await supabase
      .from("reservations")
      .select("id, deposit_amount, deposit_paid")
      .eq("id", reservation_id)
      .single();

    if (dbErr || !reservation) return json({ error: "Reserva no encontrada" }, 404);
    if (reservation.deposit_paid) return json({ error: "Esta reserva ya tiene el depósito pagado" }, 409);

    // Guard: deposit must be > 0 (Redsys rejects zero-amount transactions)
    const depositAmount = Number(reservation.deposit_amount);
    if (!depositAmount || depositAmount <= 0) {
      return json({ error: "El importe del depósito no es válido" }, 422);
    }

    // ── Redsys params ─────────────────────────────────────────────────────
    const merchantCode = Deno.env.get("REDSYS_MERCHANT_CODE");
    const terminal = Deno.env.get("REDSYS_TERMINAL") ?? "001";
    const secretKey = Deno.env.get("REDSYS_SECRET_KEY");
    const isProd = Deno.env.get("REDSYS_ENVIRONMENT") === "production";
    const notifUrl = Deno.env.get("REDSYS_MERCHANT_URL");
    const urlOk = Deno.env.get("REDSYS_URL_OK");
    const urlKo = Deno.env.get("REDSYS_URL_KO");

    if (!merchantCode || !secretKey || !notifUrl || !urlOk || !urlKo) {
      console.error("create-redsys-payment: missing required env vars");
      return json({ error: "Configuración de pago incompleta (contacta al administrador)" }, 503);
    }

    const order = buildOrder(reservation_id);

    // Amount in cents (EUR)
    const amountCents = String(Math.round(depositAmount * 100)).padStart(12, "0");

    const merchantParams = {
      DS_MERCHANT_MERCHANTCODE: merchantCode,
      DS_MERCHANT_TERMINAL: terminal,
      DS_MERCHANT_ORDER: order,
      DS_MERCHANT_AMOUNT: amountCents,
      DS_MERCHANT_CURRENCY: "978",          // EUR
      DS_MERCHANT_TRANSACTIONTYPE: "0",     // Authorisation
      DS_MERCHANT_MERCHANTURL: notifUrl,
      DS_MERCHANT_URLOK: `${urlOk}?order=${order}`,
      DS_MERCHANT_URLKO: `${urlKo}?order=${order}&ko=1`,
      DS_MERCHANT_CONSUMERLANGUAGE: "002",  // Spanish
    };

    const merchantParamsB64 = btoa(JSON.stringify(merchantParams));
    const signature = redsysSignature(secretKey, order, merchantParamsB64);

    // Save order reference to reservation
    await supabase.from("reservations").update({ redsys_order: order }).eq("id", reservation_id);

    return json({
      action: isProd ? REDSYS_PROD : REDSYS_TEST,
      formFields: {
        Ds_SignatureVersion: "HMAC_SHA256_V1",
        Ds_MerchantParameters: merchantParamsB64,
        Ds_Signature: signature,
      },
    });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
