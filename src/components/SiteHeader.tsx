import { useEffect, useState } from "react";
import { Phone } from "lucide-react";
import "./siteChrome.css";

// Cabecera del sitio, portada de roomsmadrid.es (assets en /header-roomsmadrid)
// para que el subdominio de reservas comparta el mismo menú de navegación. El
// comportamiento del script original (drawer móvil + desplegables acordeón) se
// reimplementa con estado de React. El logo es el actual de la app (coherente).

const SITE = "https://www.roomsmadrid.es";

type Booking = {
  showBack?: boolean;
  onBack?: () => void;
  phone?: { number: string; href: string };
};

type DropdownLink = { label: string; href: string };

const HABITACIONES: DropdownLink[] = [
  { label: "RM Ventas", href: `${SITE}/hotel-por-hora-parejas-hoteles-romanticos-madrid-ventas` },
  {
    label: "RM América",
    href: `${SITE}/hotel-romantico-con-habitaciones-por-horas-madrid-avenida-america`,
  },
  {
    label: "RM Bernabéu",
    href: `${SITE}/hotel-por-horas-para-adultos-y-escapadas-romanticas-en-madrid-bernabeu`,
  },
];

const TARIFAS: DropdownLink[] = [
  { label: "RM Ventas", href: `${SITE}/tarifas/ventas` },
  { label: "RM América", href: `${SITE}/tarifas/america` },
  { label: "RM Bernabéu", href: `${SITE}/tarifas/bernabeu` },
];

function ArrowIcon() {
  return (
    <svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true">
      <path d="M480-360 280-559h400L480-360Z" />
    </svg>
  );
}

export function SiteHeader({ booking }: { booking?: Booking }) {
  const [menuOpen, setMenuOpen] = useState(false);
  // Clave del desplegable abierto en la vista móvil (acordeón).
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Cierra el drawer al pasar a escritorio, igual que el script original.
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1200px)");
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setMenuOpen(false);
        setOpenDropdown(null);
      }
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  // Bloquea el scroll del body mientras el menú móvil está abierto.
  useEffect(() => {
    document.body.classList.toggle("menu-open", menuOpen);
    return () => document.body.classList.remove("menu-open");
  }, [menuOpen]);

  const closeMenu = () => {
    setMenuOpen(false);
    setOpenDropdown(null);
  };

  const toggleDropdown = (key: string) => {
    setOpenDropdown((prev) => (prev === key ? null : key));
  };

  const renderDropdown = (key: string, label: string, href: string, links: DropdownLink[]) => (
    <div
      className={`header__nav-item header__navlist--dropdown${openDropdown === key ? " is-open" : ""}`}
    >
      <div className="header__nav-item__row">
        <a href={href} className="header__nav-link" onClick={closeMenu}>
          {label}
        </a>
        <button
          type="button"
          className="header__nav-link--arrow"
          aria-expanded={openDropdown === key}
          aria-label={`Desplegar ${label}`}
          onClick={() => toggleDropdown(key)}
        >
          <ArrowIcon />
        </button>
      </div>
      <ul className="header__submenu">
        <li className="dropwdown-desktop-links">
          <div className="d-flex flex-column">
            <p className="text-blood text-uppercase">
              <strong>{label}</strong>
            </p>
            {links.map((l) => (
              <a key={l.href} href={l.href} onClick={closeMenu}>
                {l.label}
              </a>
            ))}
          </div>
        </li>
        {links.map((l) => (
          <li key={l.href} className="dropwdown-mobile-links">
            <a href={l.href} onClick={closeMenu}>
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <header className="rm-site-header">
      <div className="header__container">
        <div className="logo-mobile-container">
          <a href={SITE} className="header__logo" aria-label="Rooms Madrid">
            <img
              className="header__logo-img"
              src="/brand/rooms-madrid-horizontal-blanco.svg"
              alt="Rooms Madrid"
            />
          </a>

          <button
            id="icon-close"
            type="button"
            className={`header__button--menu${menuOpen ? " is-active" : ""}`}
            aria-label="Cerrar menú"
            onClick={closeMenu}
          >
            <svg viewBox="0 0 384 512" fill="#fff" width={20} height={20}>
              <path d="M231 256l107-107-25-25-107 107-107-107-25 25 107 107-107 107 25 25 107-107 107 107 25-25z" />
            </svg>
          </button>
        </div>

        <nav
          id="header__nav"
          className={`header__nav${menuOpen ? " is-active" : ""}`}
          aria-label="Menú principal"
          onClick={(e) => {
            // Cierra el menú al pulsar el fondo oscuro (fuera del panel).
            if (e.target === e.currentTarget) closeMenu();
          }}
        >
          <div className="header__nav-list">
            <div className="header__nav-item">
              <a href={SITE} className="header__nav-link" onClick={closeMenu}>
                Inicio
              </a>
            </div>
            {renderDropdown(
              "habitaciones",
              "Habitaciones",
              `${SITE}/habitaciones-horas-hoteles-horas-madrid-centro`,
              HABITACIONES,
            )}
            <div className="header__nav-item">
              <a href={`${SITE}/packs-exclusivos`} className="header__nav-link" onClick={closeMenu}>
                Packs exclusivos
              </a>
            </div>
            <div className="header__nav-item">
              <a href={`${SITE}/extras`} className="header__nav-link" onClick={closeMenu}>
                Extras
              </a>
            </div>
            {renderDropdown("tarifas", "Tarifas", `${SITE}/tarifas`, TARIFAS)}
            <div className="header__nav-item">
              <a href={`${SITE}/nosotros`} className="header__nav-link" onClick={closeMenu}>
                Nosotros
              </a>
            </div>
            <div className="header__nav-item">
              <a href={`${SITE}/vip`} className="header__nav-link" onClick={closeMenu}>
                Hazte VIP
              </a>
            </div>
            <div className="header__nav-item">
              <a
                href="/reservar"
                className="header__nav-link header__nav-link-vip"
                onClick={closeMenu}
              >
                RESERVAR
              </a>
            </div>
          </div>
        </nav>

        {/* Controles contextuales del flujo de reserva + acceso al menú móvil */}
        <div className="header__extra">
          {booking?.showBack && (
            <button type="button" className="header__back" onClick={booking.onBack}>
              ← Atrás
            </button>
          )}
          {booking?.phone && (
            <span className="header__help">
              <Phone size={13} />
              <span>¿Reservas?</span>
              <a href={booking.phone.href}>{booking.phone.number}</a>
            </span>
          )}
          <button
            id="ca-navbar"
            type="button"
            className={`header__button--menu${menuOpen ? " is-active" : ""}`}
            aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <svg
              viewBox="0 0 448 512"
              fill="currentColor"
              width={22}
              height={22}
              aria-hidden="true"
            >
              <path d="M16 132h416c8.837 0 16-7.163 16-16V76c0-8.837-7.163-16-16-16H16C7.163 60 0 67.163 0 76v40c0 8.837 7.163 16 16 16zm0 160h416c8.837 0 16-7.163 16-16v-40c0-8.837-7.163-16-16-16H16c-8.837 0-16 7.163-16 16v40c0 8.837 7.163 16 16 16zm0 160h416c8.837 0 16-7.163 16-16v-40c0-8.837-7.163-16-16-16H16c-8.837 0-16 7.163-16 16v40c0 8.837 7.163 16 16 16z" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
