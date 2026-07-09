import { useState } from "react";
import { getConsent, setConsent } from "@/lib/cookieConsent";
import "./siteChrome.css";

// Ventana de política de cookies, replicada del banner GDPR de roomsmadrid.es
// (mismo texto, estructura y estilos). Gestiona el consentimiento de la cookie
// de analítica (Google Analytics + Microsoft Clarity); las esenciales están
// siempre activas. Mientras no haya decisión, la analítica NO se carga.

export function CookieConsent() {
  const [decided, setDecided] = useState(() => getConsent().decided);
  const [showModal, setShowModal] = useState(false);
  // Interruptor de analítica dentro del modal (por defecto activado).
  const [analytics, setAnalytics] = useState(true);

  if (decided) return null;

  const acceptAll = () => {
    setConsent(true);
    setDecided(true);
  };

  const saveSettings = () => {
    setConsent(analytics);
    setDecided(true);
  };

  return (
    <>
      <div
        className="gdpr-cookie-notice"
        role="dialog"
        aria-live="polite"
        aria-label="Aviso de cookies"
      >
        <p className="gdpr-cookie-notice-description">
          Utilizamos cookies propias y de terceros para mejorar la navegación, medir el uso de la
          web y personalizar la experiencia. Puede aceptar todas las cookies o configurar sus
          preferencias.
        </p>
        <nav className="gdpr-cookie-notice-nav">
          <button
            type="button"
            className="gdpr-cookie-notice-nav-item gdpr-cookie-notice-nav-item-accept gdpr-cookie-notice-nav-item-btn"
            onClick={acceptAll}
          >
            Aceptar cookies
          </button>
          <button
            type="button"
            className="gdpr-cookie-notice-nav-item gdpr-cookie-notice-nav-item-settings"
            onClick={() => setShowModal(true)}
          >
            Personalización
          </button>
        </nav>
      </div>

      {showModal && (
        <div
          className="gdpr-cookie-notice-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Personalización de cookies"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false);
          }}
        >
          <div className="gdpr-cookie-notice-modal-content">
            <div className="gdpr-cookie-notice-modal-header">
              <h2 className="gdpr-cookie-notice-modal-title">Personalización</h2>
              <button
                type="button"
                className="gdpr-cookie-notice-modal-close"
                aria-label="Cerrar"
                onClick={() => setShowModal(false)}
              >
                ×
              </button>
            </div>

            <ul className="gdpr-cookie-notice-modal-cookies">
              <li className="gdpr-cookie-notice-modal-cookie">
                <div className="gdpr-cookie-notice-modal-cookie-row">
                  <p className="gdpr-cookie-notice-modal-cookie-title">
                    Cookies esenciales del sitio
                  </p>
                  <span className="gdpr-cookie-notice-modal-cookie-state">Siempre activas</span>
                </div>
                <p className="gdpr-cookie-notice-modal-cookie-info">
                  Las cookies necesarias ayudan a que un sitio web sea utilizable al habilitar
                  funciones básicas como la navegación de páginas y el acceso a áreas seguras del
                  sitio web. El sitio web no puede funcionar correctamente sin estas cookies.
                </p>
              </li>

              <li className="gdpr-cookie-notice-modal-cookie">
                <div className="gdpr-cookie-notice-modal-cookie-row">
                  <p className="gdpr-cookie-notice-modal-cookie-title">Cookies de analítica</p>
                  <button
                    type="button"
                    className="gdpr-cookie-switch"
                    role="switch"
                    aria-checked={analytics}
                    aria-label="Cookies de analítica"
                    onClick={() => setAnalytics((a) => !a)}
                  />
                </div>
                <p className="gdpr-cookie-notice-modal-cookie-info">
                  Utilizamos cookies analíticas y tecnologías de medición como Google Tag/Google
                  Analytics, Microsoft Clarity Analytics y píxeles de medición para saber cómo
                  interactúan los usuarios con la web, medir visitas y mejorar la experiencia. Puede
                  desactivarlas si no desea que se carguen estos servicios.
                </p>
              </li>
            </ul>

            <div className="gdpr-cookie-notice-modal-footer">
              <a
                href="https://www.roomsmadrid.es/politica-de-cookies"
                target="_blank"
                rel="noopener noreferrer"
                className="gdpr-cookie-notice-modal-footer-item gdpr-cookie-notice-modal-footer-item-statement"
              >
                Nuestra declaración de cookies
              </a>
              <button
                type="button"
                className="gdpr-cookie-notice-modal-footer-item gdpr-cookie-notice-modal-footer-item-save gdpr-cookie-notice-modal-footer-item-btn"
                onClick={saveSettings}
              >
                <span>Guardar configuración</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
