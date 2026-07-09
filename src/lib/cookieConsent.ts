import { useEffect, useState } from "react";

// Consentimiento de cookies para la web pública (rutas /reservar*). Replica el
// comportamiento del banner GDPR de roomsmadrid.es: las cookies esenciales
// están siempre activas y las de analítica (Google Analytics + Microsoft
// Clarity) sólo se cargan si el cliente da su consentimiento. El estado se
// persiste en localStorage y se difunde con un CustomEvent para que el banner y
// el cargador de analítica reaccionen sin recargar la página.

export type ConsentState = { decided: boolean; analytics: boolean };

const STORAGE_KEY = "rm_cookie_consent_v1";
const EVENT = "rm-consent-change";

export function getConsent(): ConsentState {
  if (typeof window === "undefined") return { decided: false, analytics: false };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { decided: false, analytics: false };
    const parsed = JSON.parse(raw) as { analytics?: boolean };
    return { decided: true, analytics: !!parsed.analytics };
  } catch {
    return { decided: false, analytics: false };
  }
}

export function setConsent(analytics: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ analytics }));
  } catch {
    /* almacenamiento no disponible (modo privado): seguimos con el evento */
  }
  window.dispatchEvent(
    new CustomEvent<ConsentState>(EVENT, { detail: { decided: true, analytics } }),
  );
}

export function subscribeConsent(cb: (state: ConsentState) => void): () => void {
  const handler = () => cb(getConsent());
  window.addEventListener(EVENT, handler);
  window.addEventListener("storage", handler); // sincroniza entre pestañas
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

// Hook de React para leer el estado de consentimiento de forma reactiva.
export function useConsent(): ConsentState {
  const [state, setState] = useState<ConsentState>(getConsent);
  useEffect(() => subscribeConsent(setState), []);
  return state;
}
