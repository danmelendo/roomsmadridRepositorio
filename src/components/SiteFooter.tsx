import "./siteChrome.css";

// Pie del sitio, portado de roomsmadrid.es (assets en /header-roomsmadrid) para
// que el subdominio de reservas comparta el mismo pie que la Home. Usa el logo
// negro de la app sobre el fondo blanco del pie (coherente con la marca).

const SITE = "https://www.roomsmadrid.es";

const PHONES = [
  { hotel: "Ventas", number: "91 060 34 81", href: "tel:+34910603481" },
  { hotel: "Bernabéu", number: "910 076 100", href: "tel:+34910076100" },
  { hotel: "América", number: "605 472 600", href: "tel:+34605472600" },
];

const LEGAL = [
  { label: "Blog", href: `${SITE}/hoteles-por-horas-madrid-centro-apartamento-horas-madrid` },
  { label: "Política de cookies", href: `${SITE}/politica-de-cookies` },
  { label: "Aviso legal", href: `${SITE}/aviso-legal` },
  { label: "Política de privacidad", href: `${SITE}/politica-de-privacidad` },
  { label: "Condiciones de reserva", href: `${SITE}/condiciones-de-reserva` },
];

export function SiteFooter() {
  return (
    <footer className="rm-site-footer">
      <section className="footer__card">
        <div className="footer__card-container">
          <div className="vip-container">
            <p className="vip-container__title">VIP</p>
            <p className="vip-container__text">CONOCE LAS VENTAJAS</p>
          </div>
          <a href={`${SITE}/vip`} className="btn-vip">
            Házte miembro
          </a>
        </div>
      </section>

      <div className="footer__container">
        <section className="footer__description">
          <img
            className="footer__description-logo"
            src="/brand/rooms-madrid-horizontal-blanco.svg"
            alt="Rooms Madrid"
            loading="lazy"
          />
          <p>
            Somos un hotel para parejas en Madrid único en su clase. Centramos nuestros esfuerzos en
            tu comodidad y discreción. Nuestras suites están diseñadas para vuestro disfrute y
            satisfacción garantizadas.
          </p>
        </section>

        <div className="vertical-line" />

        <section className="footer__contact">
          <div className="footer__contact-left">
            <p className="footer__contact-title">CONTACTO</p>
            {PHONES.map((p) => (
              <p key={p.hotel}>
                {p.hotel}:<br />
                <a className="font-text" href={p.href} rel="nofollow noopener">
                  {p.number}
                </a>
              </p>
            ))}
            <p className="footer__contact-link">
              <a href="mailto:reservas@roomsmadrid.es" target="_blank" rel="nofollow noopener">
                reservas@roomsmadrid.es
              </a>
            </p>
          </div>

          <div className="footer__contact-right">
            <p className="footer__contact-title">REDES SOCIALES</p>
            <div className="footer__contact-icons">
              <a
                href="https://www.instagram.com/rooms_madrid/"
                target="_blank"
                rel="nofollow noopener"
                aria-label="Instagram"
              >
                <img src="/brand/icons/icon-ig.png" alt="Instagram" loading="lazy" />
              </a>
              <a
                href="https://www.youtube.com/channel/UCjwTmW2N9wQN53ugeETpdvg"
                target="_blank"
                rel="nofollow noopener"
                aria-label="YouTube"
              >
                <img src="/brand/icons/icon-youtube.png" alt="YouTube" loading="lazy" />
              </a>
              <a
                href="https://www.tiktok.com/@rooms.madrid"
                target="_blank"
                rel="nofollow noopener"
                aria-label="TikTok"
              >
                <img src="/brand/icons/icon-tiktok.png" alt="TikTok" loading="lazy" />
              </a>
            </div>

            <p className="footer__contact-title">LINKS</p>
            {LEGAL.map((l) => (
              <p key={l.href} className="footer__contact-link">
                <a href={l.href} target="_blank" rel="nofollow noopener">
                  {l.label}
                </a>
              </p>
            ))}
          </div>
        </section>
      </div>

      <div className="footer__bottom">© Rooms Madrid · Solo +18 · Bebe con responsabilidad</div>
    </footer>
  );
}
