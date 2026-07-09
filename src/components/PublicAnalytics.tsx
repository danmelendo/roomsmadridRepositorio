import { useEffect } from "react";
import { useConsent } from "@/lib/cookieConsent";

// Analytics para la web pública de clientes (rutas /reservar*). Se monta SOLO
// en las páginas transitables por clientes, nunca en el panel interno de
// recepción, para no contaminar las métricas con la actividad del personal.
//
// La app es una SPA sin <HeadContent />, así que inyectamos los tags de forma
// imperativa en <head> (igual que hacen los snippets oficiales). La inyección
// es idempotente: si el usuario navega entre varias páginas públicas o React
// remonta el componente, los scripts se cargan una única vez.
//
// Los tags SÓLO se cargan tras el consentimiento de la cookie de analítica
// (ver <CookieConsent /> y src/lib/cookieConsent.ts), en línea con la ventana
// de cookies replicada de roomsmadrid.es.

const CLARITY_PROJECT_ID = "x4d46j1gbg";
const GA_MEASUREMENT_ID = "G-X84N073RKQ";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function injectClarity() {
  if (document.getElementById("ms-clarity")) return;
  const s = document.createElement("script");
  s.id = "ms-clarity";
  s.type = "text/javascript";
  s.innerHTML = `(function(c,l,a,r,i,t,y){
    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
  })(window, document, "clarity", "script", "${CLARITY_PROJECT_ID}");`;
  document.head.appendChild(s);
}

function injectGoogleAnalytics() {
  if (document.getElementById("ga-gtag")) return;

  const loader = document.createElement("script");
  loader.id = "ga-gtag";
  loader.async = true;
  loader.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(loader);

  const inline = document.createElement("script");
  inline.id = "ga-gtag-init";
  inline.innerHTML = `window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag("js", new Date());
    gtag("config", "${GA_MEASUREMENT_ID}");`;
  document.head.appendChild(inline);
}

export function PublicAnalytics() {
  const { analytics } = useConsent();

  useEffect(() => {
    if (!analytics) return;
    injectClarity();
    injectGoogleAnalytics();
  }, [analytics]);

  return null;
}
