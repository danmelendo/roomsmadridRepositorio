import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Loader2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PublicAnalytics } from "@/components/PublicAnalytics";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { CookieConsent } from "@/components/CookieConsent";

export const Route = createFileRoute("/reservar-ok")({
  component: RedsysReturnPage,
  validateSearch: (s: Record<string, unknown>) => ({
    order: typeof s.order === "string" ? s.order : undefined,
    ko: s.ko === "1" || s.ko === "true" ? true : undefined,
  }),
  head: () => ({
    meta: [{ title: "Pago · Rooms Madrid" }],
  }),
});

// The confirmation shown to the customer is driven by the REAL payment state
// (reservations.deposit_paid), never by the redirect URL alone — otherwise a
// failed/uncaptured payment would still read "confirmada". The redsys
// notification webhook sets deposit_paid asynchronously, so we poll briefly.
type PayState = "checking" | "confirmed" | "pending" | "failed";

function RedsysReturnPage() {
  const { order, ko } = Route.useSearch();
  const [state, setState] = useState<PayState>(ko ? "failed" : "checking");

  useEffect(() => {
    if (ko) {
      // Payment failed/cancelled: mark the (still unpaid) reservation as
      // "rejected" so it is kept for the record but no longer blocks the slot.
      if (!order) return;
      (async () => {
        const { data } = await supabase
          .from("reservations")
          .select("id")
          .eq("redsys_order", order)
          .eq("deposit_paid", false)
          .maybeSingle();
        if (data?.id)
          await supabase
            .from("reservations")
            .update({
              status: "rejected",
              cancellation_reason: "Pago no completado por el cliente",
            } as never)
            .eq("id", data.id);
      })();
      return;
    }
    if (!order) {
      setState("pending");
      return;
    }

    // Poll deposit_paid for ~16s (8 × 2s) to let the server-to-server webhook
    // land, then settle to "confirmed" or "pending" (never a false "confirmed").
    let cancelled = false;
    let tries = 0;
    const check = async () => {
      const { data } = await supabase
        .from("reservations")
        .select("deposit_paid, status")
        .eq("redsys_order", order)
        .maybeSingle();
      if (cancelled) return;
      if (data?.deposit_paid) {
        setState("confirmed");
        return;
      }
      if (++tries >= 8) {
        setState("pending");
        return;
      }
      setTimeout(check, 2000);
    };
    check();
    return () => {
      cancelled = true;
    };
  }, [ko, order]);

  const ink = "#0b0c0c",
    soft = "#7a7066",
    blood = "#731423";

  return (
    <div
      style={{
        fontFamily: "'Noto Sans', sans-serif",
        background: "#f6f3ec",
        minHeight: "100svh",
        display: "flex",
        flexDirection: "column",
        color: ink,
      }}
    >
      <PublicAnalytics />
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans:ital,wght@0,300;0,400;0,600;0,700;1,400&family=Playfair:ital,wght@0,400..900;1,400..900&display=swap');@keyframes rmspin{to{transform:rotate(360deg)}}`}</style>

      <SiteHeader />

      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "56px 24px",
        }}
      >
        <div
          style={{
            background: "#fff",
            border: "1px solid rgba(115,20,35,0.18)",
            borderTop: `3px solid ${blood}`,
            borderRadius: 20,
            padding: "48px 40px",
            maxWidth: 460,
            width: "100%",
            textAlign: "center",
            boxShadow: "0 8px 48px rgba(11,12,12,0.08)",
          }}
        >
          {state === "checking" && (
            <>
              <Loader2
                size={44}
                color={blood}
                style={{ marginBottom: 20, animation: "rmspin 1s linear infinite" }}
              />
              <h1
                style={{
                  fontFamily: "'Playfair', serif",
                  fontSize: 32,
                  fontWeight: 600,
                  marginBottom: 12,
                }}
              >
                Verificando tu pago…
              </h1>
              <p style={{ fontSize: 15, color: soft, lineHeight: 1.65 }}>
                Estamos confirmando la transacción con el banco. No cierres esta ventana.
              </p>
            </>
          )}

          {state === "confirmed" && (
            <>
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: "50%",
                  background: "rgba(115,20,35,0.10)",
                  border: "1px solid rgba(115,20,35,0.28)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 24px",
                }}
              >
                <CheckCircle2 size={32} color={blood} />
              </div>
              <h1
                style={{
                  fontFamily: "'Playfair', serif",
                  fontSize: 42,
                  fontWeight: 600,
                  marginBottom: 14,
                }}
              >
                ¡Reserva
                <br />
                confirmada!
              </h1>
              <p style={{ fontSize: 15, color: soft, lineHeight: 1.65, marginBottom: 8 }}>
                Tu pago ha sido procesado correctamente. Te enviaremos un email de confirmación con
                todos los detalles.
              </p>
              <p style={{ fontSize: 13, color: soft, lineHeight: 1.65, marginBottom: 8 }}>
                Si no lo encuentras, revisa la carpeta de spam.
              </p>
              {order && (
                <p
                  style={{ fontSize: 12, color: "#9a9082", marginTop: 4, letterSpacing: "0.06em" }}
                >
                  Referencia de pago: {order}
                </p>
              )}
            </>
          )}

          {state === "pending" && (
            <>
              <Clock size={44} color={blood} style={{ marginBottom: 20 }} />
              <h1
                style={{
                  fontFamily: "'Playfair', serif",
                  fontSize: 32,
                  fontWeight: 600,
                  marginBottom: 12,
                }}
              >
                Pago en verificación
              </h1>
              <p style={{ fontSize: 15, color: soft, lineHeight: 1.65, marginBottom: 8 }}>
                No hemos podido confirmar el cobro todavía. Si se ha realizado, recibirás un email
                de confirmación en breve.
              </p>
              <p style={{ fontSize: 13, color: soft, lineHeight: 1.65, marginBottom: 24 }}>
                Si no recibes confirmación o tienes dudas, contáctanos antes de volver a intentarlo
                para no duplicar el cobro.
              </p>
            </>
          )}

          {state === "failed" && (
            <>
              <XCircle size={48} color={blood} style={{ marginBottom: 20 }} />
              <h1
                style={{
                  fontFamily: "'Playfair', serif",
                  fontSize: 36,
                  fontWeight: 600,
                  marginBottom: 12,
                }}
              >
                Pago no completado
              </h1>
              <p style={{ fontSize: 15, color: soft, lineHeight: 1.65, marginBottom: 8 }}>
                El pago no se ha podido procesar. Tu reserva no ha sido confirmada.
              </p>
              <p style={{ fontSize: 13, color: soft, lineHeight: 1.65, marginBottom: 32 }}>
                Puedes intentarlo de nuevo o contactarnos si el problema persiste.
              </p>
            </>
          )}

          {state !== "checking" && (
            <Link
              to="/reservar"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: "linear-gradient(180deg, #8b1027 0%, #731423 100%)",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                height: 52,
                padding: "0 32px",
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                textDecoration: "none",
                marginTop: 8,
              }}
            >
              {state === "failed"
                ? "Intentar de nuevo"
                : state === "pending"
                  ? "Volver"
                  : "Hacer otra reserva"}
            </Link>
          )}
        </div>

        <p style={{ marginTop: 24, fontSize: 12, color: "#9a9082" }}>
          Rooms Madrid · Pago seguro procesado por Redsys
        </p>
      </main>

      <SiteFooter />

      <CookieConsent />
    </div>
  );
}
