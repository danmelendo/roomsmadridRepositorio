import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  CalendarIcon,
  ShieldCheck,
  CheckCircle2,
  CreditCard,
  Plus,
  Minus,
  Gift,
  Phone,
  ChevronRight,
  Tv,
  Armchair,
  Moon,
  Clock,
  Star,
  Flame,
  MapPin,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import { calculatePrice, round2, type PriceBreakdown } from "@/lib/pricing";
import { DURATIONS, DURATION_LABELS, eur, isOvernightAllowed, buildingKey } from "@/lib/data";
import { discountEurosForRoom, type DiscountType } from "@/lib/promos";
import { roomForSlug } from "@/lib/roomSlugs";

import { DecorationCarousel } from "@/components/DecorationCarousel";
import { RoomImageCarousel } from "@/components/RoomImageCarousel";
import { PublicAnalytics } from "@/components/PublicAnalytics";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { CookieConsent } from "@/components/CookieConsent";

// Map to dynamically resolve room images from /public/imagenes. Each room can
// list several photos that are shown in a manual carousel (no autoscroll). Only
// photos whose name matches the room are listed here.
const ROOM_IMAGES_MAP: Record<string, Record<string, string[]>> = {
  bernabeu: {
    Grey: ["/imagenes/Bernabeu/Grey/greybernabeu.jpeg"],
    Ocean: [
      "/imagenes/Bernabeu/Ocean/habitaciones-por-horas-hotel-romantico-madrid-bernabeu-ocean-1.webp",
    ],
    Paris: [
      "/imagenes/Bernabeu/Paris/habitaciones-por-horas-hotel-romantico-madrid-bernabeu-paris-4.webp",
    ],
    Safari: [
      "/imagenes/Bernabeu/Safari/habitaciones-por-horas-hotel-romantico-madrid-bernabeu-safari-4.webp",
    ],
    Tokyo: [
      "/imagenes/Bernabeu/Tokio/habitaciones-por-horas-hotel-romantico-madrid-bernabeu-tokio-1.webp",
    ],
  },
  ventas: {
    "Empire State": [
      "/imagenes/Ventas/Empire State/habitacion-romantica-hotel-madrid-ventas-empire-state-2.webp",
      "/imagenes/Ventas/Empire State/Empire_1.jpeg",
      "/imagenes/Ventas/Empire State/Empire_2.jpeg",
      "/imagenes/Ventas/Empire State/Empire_jacuzzi.jpeg",
    ],
    Grey: [
      "/imagenes/Ventas/Grey/01.PNG",
      "/imagenes/Ventas/Grey/02.PNG",
      "/imagenes/Ventas/Grey/03.PNG",
      "/imagenes/Ventas/Grey/05.PNG",
      "/imagenes/Ventas/Grey/06.PNG",
      "/imagenes/Ventas/Grey/07.PNG",
      "/imagenes/Ventas/Grey/08.PNG",
      "/imagenes/Ventas/Grey/09.PNG",
      "/imagenes/Ventas/Grey/10.jpg",
      "/imagenes/Ventas/Grey/11.PNG",
      "/imagenes/Ventas/Grey/12.PNG",
    ],
    Hollywood: [
      "/imagenes/Ventas/Hollywood/Hollywood_1.jpeg",
      "/imagenes/Ventas/Hollywood/Hollywood_2.jpeg",
      "/imagenes/Ventas/Hollywood/Hollywood_3.jpeg",
      "/imagenes/Ventas/Hollywood/Hollywood_4.jpeg",
    ],
    Music: [
      "/imagenes/Ventas/Music/15A1DD58-967F-44AF-9389-2999746452E1.png",
      "/imagenes/Ventas/Music/1605D0D3-DC30-4DE8-AF92-41D334E9FB1F.png",
      "/imagenes/Ventas/Music/2B9E4E98-28E7-4E62-862A-2CE1C4D0C857.png",
      "/imagenes/Ventas/Music/7CB89554-92C8-470A-90A1-9D2C5326DFAB.png",
      "/imagenes/Ventas/Music/894BD178-1999-446F-9F06-D70A9E8FA168.png",
      "/imagenes/Ventas/Music/9C000FD8-B8DE-4392-883C-DD20B8681AAD.png",
      "/imagenes/Ventas/Music/BBC52576-5AE2-4F39-870A-947F1112EF70.png",
      "/imagenes/Ventas/Music/C6B73C3C-0758-4A03-B9EB-46DD4D41EEE2.png",
      "/imagenes/Ventas/Music/DADF31B3-AB0C-4EDD-9486-3976D5FEB3E4.png",
      "/imagenes/Ventas/Music/E699A73D-3ACA-40DF-9463-46FF0E1EE89B.png",
    ],
    "Route 66": [
      "/imagenes/Ventas/Route 66/ruta66nueva.jpeg",
      "/imagenes/Ventas/Route 66/ruta66.jpeg",
      "/imagenes/Ventas/Route 66/ruta66_2.jpeg",
      "/imagenes/Ventas/Route 66/JacuzziRuta66.jpeg",
      "/imagenes/Ventas/Route 66/Ruta66_tantra.jpeg",
    ],
    "El Cairo": [
      "/imagenes/Ventas/El Cairo/Cairo1.jpeg",
      "/imagenes/Ventas/El Cairo/Cairo2.jpeg",
      "/imagenes/Ventas/El Cairo/Cairo3.jpeg",
      "/imagenes/Ventas/El Cairo/Cairo4.jpeg",
      "/imagenes/Ventas/El Cairo/Cairo5.jpeg",
      "/imagenes/Ventas/El Cairo/Cairo6.jpeg",
      "/imagenes/Ventas/El Cairo/Cairo7.jpeg",
      "/imagenes/Ventas/El Cairo/Cairo8.jpeg",
      "/imagenes/Ventas/El Cairo/Cairo9.jpeg",
      "/imagenes/Ventas/El Cairo/CairoDeco.jpeg",
    ],
    Miami: [
      "/imagenes/Ventas/Miami/Miami1.jpeg",
      "/imagenes/Ventas/Miami/Miami2.jpeg",
      "/imagenes/Ventas/Miami/Miami3.jpeg",
      "/imagenes/Ventas/Miami/Miami4.jpeg",
      "/imagenes/Ventas/Miami/Miami5.jpeg",
      "/imagenes/Ventas/Miami/Miami6.jpeg",
      "/imagenes/Ventas/Miami/Miami7.jpeg",
      "/imagenes/Ventas/Miami/Miami8.jpeg",
    ],
    // (Bali Deluxe sigue pendiente de alta en BD.)
  },
  america: {
    Dubai: ["/imagenes/America/Dubai/Dubainueva.jpeg"],
    Grey: ["/imagenes/America/Grey/grey-america-03.jpg"],
    Maldivas: ["/imagenes/America/Maldivas/maldivas-03--hoteles-para-parejas-baratos.webp"],
    "New York": [
      "/imagenes/America/New York/nueva-york-04--reservar-habitaciones-por-horas-en-madrid.webp",
    ],
    "Tu y yo": [
      "/imagenes/America/Tu y yo/tu-y-yo-galeria-05--hoteles-para-parejas-en-madrid.webp",
    ],
  },
};

export const Route = createFileRoute("/reservar")({
  component: PublicReservePage,
  head: () => ({
    meta: [
      { title: "Reserva · Rooms Madrid" },
      {
        name: "description",
        content:
          "Habitaciones temáticas con jacuzzi en el centro de Madrid. Reserva online en 2 minutos. Solo +18.",
      },
    ],
  }),
});

type Step = "search" | "room-detail" | "details" | "payment" | "done";

interface RoomLite {
  id: string;
  name: string;
  building: string;
  capacity: number;
  jacuzzi: "always" | "optional" | "none";
  has_tv: boolean;
  has_swing: boolean;
  rate_group_id: string | null;
  allows_overnight: boolean;
  status: string;
}

interface ExtraLite {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
}

const ROOM_IMAGE_FALLBACK =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'%3E%3Crect fill='%23ccc' width='400' height='300'/%3E%3Ctext x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='20' fill='%23999'%3EHabitación%3C/text%3E%3C/svg%3E";

// Returns all photos for a room (for the carousel). Falls back to a generic
// placeholder when no photos are registered for the room.
function getRoomImages(r: { name: string; building: string }): string[] {
  const building = r.building.toLowerCase();
  const buildingMap = ROOM_IMAGES_MAP[building as keyof typeof ROOM_IMAGES_MAP];
  const imgs = buildingMap?.[r.name];
  if (imgs && imgs.length) return imgs;
  return [ROOM_IMAGE_FALLBACK];
}

// Returns the primary (first) photo for a room — used for thumbnails/summaries.
function getRoomImage(r: { name: string; building: string }) {
  return getRoomImages(r)[0];
}

// Short, suggestive descriptions per room, inspired by each room's photos.
// Kept brief on purpose so they don't cover the room screen excessively.
const ROOM_DESCRIPTIONS: Record<string, Record<string, string>> = {
  ventas: {
    "Empire State": "La ciudad que nunca duerme a vuestros pies… y vosotros tampoco.",
    Grey: "Luces rojas y rincones de seducción para liberar la imaginación.",
    Hollywood: "Sed los protagonistas de vuestra propia película sin censura.",
    Music: "Luces de fiesta, ritmo y burbujas para subir el volumen de la pasión.",
    "Route 66": "Una escapada salvaje por la ruta del deseo bajo un cielo de fuego.",
    "El Cairo": "Oro, pirámides y misterio milenario para una noche de faraones.",
    Miami: "Neón rosa, palmeras y skyline: la noche eterna de South Beach.",
  },
  bernabeu: {
    Grey: "Penumbra, neón y juego: dejaos llevar sin reglas.",
    Ocean: "Sumergíos en las profundidades de una noche azul e infinita.",
    Paris: "La ciudad del amor enciende los sentidos al caer la tarde.",
    Safari: "Despertad vuestro lado más salvaje en plena sabana.",
    Tokyo: "Neón, pétalos y noche eléctrica: un Tokio hecho para dos.",
  },
  america: {
    Grey: "Cuero, neón rojo y penumbra: el escenario para perder el control.",
    Dubai: "Lujo de oro negro, champán y pétalos para una noche sin límites.",
    Maldivas: "Una isla privada donde el tiempo se detiene y solo existís vosotros.",
    "New York": "Bajo las luces de Manhattan, una noche de cine para dos.",
    "Tu y yo": "Solo vosotros, sin testigos: intimidad en estado puro.",
  },
};

// Returns a tailored suggestive description for a room, falling back to a
// generic line when the room has no bespoke copy registered.
function getRoomDescription(r: { name: string; building: string; capacity: number }): string {
  const building = r.building.toLowerCase();
  const custom = ROOM_DESCRIPTIONS[building as keyof typeof ROOM_DESCRIPTIONS]?.[r.name];
  if (custom) return custom;
  return `Habitación temática para ${r.capacity} personas.`;
}

// Rooms that feature a screen. Shown as a single "Pantalla LED" badge.
// También cambia el rótulo del mensaje de decoración a "Mensaje en la pantalla"
// (ver messageSurfaceLabel).
// OJO: esto es la PANTALLA de proyección de contenido/mensajes, NO una simple TV
// de pantalla plana. El Cairo y Miami tienen TV plana pero NO entran aquí.
const ROOMS_WITH_SCREEN: Record<string, string[]> = {
  america: ["Dubai", "New York"],
  ventas: ["Music", "Grey"],
  bernabeu: ["Safari"],
};

// Salas con CUBO LED. Además de mostrar el badge, habilita el extra "cubo LED"
// (ver extraAvailableForRoom). El Cairo y Miami NO lo tienen: el cliente
// confirmó que solo cuentan con columpio y TV de pantalla plana.
const ROOMS_WITH_LED_CUBE: Record<string, string[]> = {
  ventas: ["Route 66"],
  bernabeu: ["Grey"],
};

// Salas que admiten el extra COLUMPIO. Habilita el extra en la lista
// (ver extraAvailableForRoom) Y muestra el badge "Columpio".
// Debe ir en línea con el flag `rooms.has_swing` de la BD.
// El Cairo y Miami: columpio confirmado por el cliente (jul-2026).
const ROOMS_WITH_SWING_EXTRA: Record<string, string[]> = {
  america: ["Dubai", "Grey", "Tu y yo"],
  ventas: ["Hollywood", "Empire State", "Music", "Grey", "El Cairo", "Miami"],
  bernabeu: ["Tokyo", "Paris", "Grey"],
};

function hasScreen(r: { name: string; building: string }): boolean {
  return ROOMS_WITH_SCREEN[buildingKey(r.building)]?.includes(r.name) ?? false;
}

function hasLedCube(r: { name: string; building: string }): boolean {
  return ROOMS_WITH_LED_CUBE[buildingKey(r.building)]?.includes(r.name) ?? false;
}

function allowsSwingExtra(r: { name: string; building: string }): boolean {
  return ROOMS_WITH_SWING_EXTRA[buildingKey(r.building)]?.includes(r.name) ?? false;
}

function isSwingExtra(ex: ExtraLite): boolean {
  return /colump/i.test(ex.name);
}

function swingExtraMatchesMode(ex: ExtraLite, overnight: boolean): boolean {
  if (!isSwingExtra(ex)) return true;
  return overnight ? /noche/i.test(ex.name) : /hora/i.test(ex.name);
}

function displayExtraName(ex: ExtraLite): string {
  if (!isSwingExtra(ex)) return ex.name;
  return ex.name.replace(/\s*\((por horas|noche completa)\)/i, "").trim();
}

function isLedCubeExtra(ex: ExtraLite): boolean {
  return /cubo/i.test(ex.name) && /led/i.test(ex.name);
}

function extraAvailableForRoom(ex: ExtraLite, r: { name: string; building: string }): boolean {
  if (isSwingExtra(ex)) return allowsSwingExtra(r);
  if (isLedCubeExtra(ex)) return hasLedCube(r);
  return true;
}

function messageSurfaceLabel(r: { name: string; building: string }) {
  if (hasLedCube(r)) return "Mensaje en el cubo LED";
  if (hasScreen(r)) return "Mensaje en la pantalla";
  return "Mensaje en el cristal";
}

// Real uploaded decoration photos shown in an auto-advancing carousel on every
// decoration card. Add more files in /public/imagenes and list them here.
// (No AI-generated placeholders — cava/Moët/Juvé bottle images were removed.)
const DECORATION_PHOTOS: string[] = [
  "/imagenes/maldivasdecoespacial.JPG",
  "/imagenes/dubaiteamo.PNG",
  "/imagenes/moetpremiumdeluxe.PNG",
  "/imagenes/Decos/Premium/DecoPremium.jpeg",
  "/imagenes/Decos/Premium/decopremium_2.jpeg",
];

const EXTRA_CATEGORY_LABELS: Record<string, string> = {
  decoration: "Decoración",
  drinks: "Bebidas",
  hookah: "Cachimba",
  accessories: "Accesorios",
};

// Decorations above the basic "Especial" (20 €) — i.e. Plus (30 €), Premium
// (50 €) and Premium Deluxe (145 €) — include personalised phrases that staff
// set up in the room, so the customer must enter them when selecting one.
const DECORATION_FREE_MESSAGE_MAX_PRICE = 20;
const BED_MESSAGE_MAX_WORDS = 2;
const SCREEN_MESSAGE_MAX_WORDS = 10;

function decorationNeedsMessage(ex: ExtraLite) {
  return ex.category === "decoration" && Number(ex.price) > DECORATION_FREE_MESSAGE_MAX_PRICE;
}

// Debug discount code: reduces the total by 99.9% so the Redsys deposit drops to
// the gateway minimum (0.01 €), letting us test the real TPV with a tiny charge.
// NOTE: validated client-side only — it is visible in the JS bundle and amounts
// are not enforced server-side. Remove/disable before opening real sales.
const DEBUG_DISCOUNT_CODE = "RMDEBUG999";
const DEBUG_DISCOUNT_PCT = 0.999;
const REDSYS_MIN_EUR = 0.01;

function countWords(s: string) {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

interface DecoMessage {
  bed: string;
  screen: string;
}

// A discount code the customer has successfully applied. `id` is null for the
// debug code (which has no DB row); `debug` discounts the whole total instead of
// just the room price.
interface AppliedPromo {
  id: string | null;
  code: string;
  type: DiscountType;
  value: number;
  debug?: boolean;
}

const STEPS = [
  { key: "search", label: "Buscar" },
  { key: "room-detail", label: "Tu habitación" },
  { key: "details", label: "Tus datos" },
  { key: "payment", label: "Pago" },
];

const STEP_INDEX: Record<Step, number> = {
  search: 0,
  "room-detail": 1,
  details: 2,
  payment: 3,
  done: 4,
};

const BUILDINGS: { value: string; label: string; address: string }[] = [
  {
    value: "bernabeu",
    label: "RM Bernabéu",
    address: "Calle Infanta Mercedes, 9 · CP 28020 Madrid",
  },
  {
    value: "ventas",
    label: "RM Ventas",
    address: "Madrid",
  },
  {
    value: "america",
    label: "RM América",
    address: "Av. América, 15 · CP 28028 Madrid",
  },
];

const CONTACTS: Record<
  string,
  { phones: { number: string; href: string }[]; email: string; address: string }
> = {
  bernabeu: {
    phones: [
      { number: "910 076 100", href: "tel:+34910076100" },
      { number: "685 066 656", href: "tel:+34685066656" },
    ],
    email: "reservas@roomsmadrid.es",
    address: "Calle Infanta Mercedes, 9 · CP 28020 Madrid",
  },
  ventas: {
    phones: [
      { number: "91 060 34 81", href: "tel:+34910603481" },
      { number: "657 992 990", href: "tel:+34657992990" },
    ],
    email: "reservas@roomsmadrid.es",
    address: "Madrid",
  },
  america: {
    phones: [
      { number: "605 472 600", href: "tel:+34605472600" },
      { number: "605 472 600", href: "tel:+34605472600" },
    ],
    email: "reservas@roomsmadrid.es",
    address: "Av. América, 15 · CP 28028 Madrid",
  },
};

// WhatsApp booking line per hotel (mobile numbers). Used for the alternative
// "reservar por WhatsApp" flow — no card payment, no DB write: it just opens a
// chat with the reservation details prefilled so reception confirms manually.
const WHATSAPP_NUMBERS: Record<string, { display: string; intl: string }> = {
  bernabeu: { display: "605 472 600", intl: "34605472600" },
  ventas: { display: "685 066 656", intl: "34685066656" },
  america: { display: "657 992 990", intl: "34657992990" },
};

// ─────────────────────────────────────────────
// Styles (injected once via <style> tag)
// ─────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans:ital,wght@0,300;0,400;0,600;0,700;1,400&family=Playfair:ital,wght@0,400..900;1,400..900&display=swap');

  .rm-page {
    /* Brand palette — Rooms Madrid insignia red over near-black & cream */
    --blood: #731423;
    --blood-light: #8b1027;
    --blood-dark: #5c0f1c;
    /* Former gold accents remapped to the insignia red. --gold-light is a
       readable tint used over near-black backgrounds. */
    --gold: #731423;
    --gold-light: #cf7a89;
    --gold-dark: #5c0f1c;
    --ink: #0b0c0c;
    --ink-mid: #3a3530;
    --ink-soft: #7a7066;
    --cream: #f6f3ec;
    --cream-dark: #ece4d3;
    --warm-white: #fffdf9;
    --border: rgba(115,20,35,0.18);
    --border-strong: rgba(115,20,35,0.42);
    font-family: 'Noto Sans', sans-serif;
    background: var(--cream);
    color: var(--ink);
    min-height: 100svh;
    /* Defensive guard against horizontal overflow on small screens. overflow-x
       clip (not hidden/auto) does NOT create a scroll container, so the sticky
       header/summary keep working while any accidental overshoot is trimmed. */
    overflow-x: clip;
  }
  .rm-page img { max-width: 100%; }

  .rm-page * { box-sizing: border-box; }
  .rm-page *:where(:not(input):not(button):not(select):not(textarea)) { margin: 0; padding: 0; }

  .rm-serif { font-family: 'Playfair', Georgia, serif; }

  /* Header */
  .rm-header {
    position: sticky; top: 0; z-index: 50;
    background: var(--ink);
    border-bottom: 2px solid var(--blood);
  }
  .rm-header-inner {
    max-width: 1100px; margin: 0 auto;
    padding: 0 24px;
    height: 64px;
    display: flex; align-items: center; gap: 20px;
  }
  .rm-logo-img {
    height: 30px; width: auto; display: block; flex-shrink: 0;
  }
  @media (max-width: 600px) { .rm-logo-img { height: 24px; } }
  .rm-logo {
    font-family: 'Playfair', serif;
    font-size: 22px; font-weight: 600; letter-spacing: 0.08em;
    color: var(--gold);
    text-transform: uppercase;
    white-space: nowrap;
  }
  .rm-logo span { color: #fff; }
  .rm-help {
    margin-left: auto;
    display: flex; align-items: center; gap: 8px;
    color: rgba(255,255,255,0.6); font-size: 13px;
  }
  .rm-help a { color: var(--gold-light); text-decoration: none; font-weight: 500; }

  /* Age banner */
  .rm-age-banner {
    background: var(--blood);
    text-align: center;
    padding: 7px 16px;
    font-size: 12px; font-weight: 600; letter-spacing: 0.05em;
    color: #fff;
    display: flex; align-items: center; justify-content: center; gap: 6px;
  }

  /* Step indicator */
  .rm-steps {
    background: var(--warm-white);
    border-bottom: 1px solid var(--border);
  }
  .rm-steps-inner {
    max-width: 1100px; margin: 0 auto;
    padding: 0 24px;
    display: flex; align-items: center;
    height: 52px; gap: 0;
  }
  .rm-step {
    display: flex; align-items: center; gap: 10px;
    padding: 0 4px;
    font-size: 13px;
    color: var(--ink-soft);
    flex-shrink: 0;
  }
  .rm-step-num {
    width: 24px; height: 24px; border-radius: 50%;
    border: 1.5px solid currentColor;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 500;
    flex-shrink: 0;
  }
  .rm-step.active { color: var(--gold-dark); font-weight: 500; }
  .rm-step.active .rm-step-num { background: var(--gold); border-color: var(--gold); color: #fff; }
  .rm-step.done { color: var(--ink-mid); }
  .rm-step.done .rm-step-num { background: var(--ink-mid); border-color: var(--ink-mid); color: #fff; }
  .rm-step-sep { flex: 1; height: 1px; background: var(--border); min-width: 12px; max-width: 60px; }

  /* ── Mobile overflow fixes ──
     On phones the header row (logo + back + website pill + phone) and the step
     bar can be wider than the viewport, pushing the whole page sideways (the
     blank area when scrolling right). Tighten spacing, drop the phone helper,
     and let the step bar scroll within itself instead of the page. */
  @media (max-width: 600px) {
    .rm-header-inner { gap: 10px; padding: 0 14px; }
    .rm-help { display: none; }
    .rm-steps-inner {
      padding: 0 14px;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .rm-steps-inner::-webkit-scrollbar { display: none; }
    .rm-step { font-size: 12px; }
    .rm-step-num { width: 22px; height: 22px; }
    .rm-step-sep { min-width: 8px; }
    .rm-main { padding: 28px 16px 64px; }
  }

  /* Main layout */
  .rm-main {
    max-width: 1100px; margin: 0 auto;
    padding: 40px 24px 80px;
  }

  /* ── SEARCH STEP ── */
  .rm-hero { text-align: center; margin-bottom: 48px; }
  .rm-hero-eyebrow {
    font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase;
    color: var(--blood); font-weight: 600; margin-bottom: 12px;
    display: flex; align-items: center; justify-content: center; gap: 8px;
  }
  .rm-hero h1 {
    font-family: 'Playfair', serif;
    font-size: clamp(38px, 7vw, 68px);
    font-weight: 500; line-height: 1.08;
    color: var(--ink);
    margin-bottom: 16px;
  }
  .rm-hero h1 em { font-style: italic; color: var(--blood); }
  .rm-hero p { font-size: 16px; color: var(--ink-soft); max-width: 480px; margin: 0 auto; line-height: 1.65; }

  .rm-search-card {
    background: var(--warm-white);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 32px;
    max-width: 720px; margin: 0 auto 32px;
    box-shadow: 0 4px 40px rgba(26,20,16,0.06);
  }
  @media (max-width: 600px) {
    .rm-search-card { padding: 20px 16px; border-radius: 12px; }
    .rm-card { padding: 20px 16px; }
  }
  .rm-search-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  @media (max-width: 600px) {
    .rm-search-grid { grid-template-columns: 1fr; }
  }
  .rm-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .rm-label {
    font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase;
    font-weight: 500; color: var(--ink-soft);
  }

  .rm-overnight-row {
    grid-column: 1 / -1;
    display: flex; align-items: center; justify-content: space-between;
    background: var(--cream);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 14px 18px;
  }
  .rm-overnight-row-label { font-size: 14px; font-weight: 500; color: var(--ink); }
  .rm-overnight-row-sub { font-size: 12px; color: var(--ink-soft); margin-top: 2px; }

  .rm-btn-primary {
    grid-column: 1 / -1;
    background: linear-gradient(180deg, var(--blood-light) 0%, var(--blood) 100%);
    color: #fff;
    border: none;
    border-radius: 10px;
    height: 52px;
    font-size: 14px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase;
    cursor: pointer;
    transition: background 0.2s, color 0.2s, box-shadow 0.2s;
    display: flex; align-items: center; justify-content: center; gap: 8px;
    font-family: 'Noto Sans', sans-serif;
  }
  .rm-btn-primary:hover { background: linear-gradient(180deg, var(--blood) 0%, var(--blood-dark) 100%); color: #fff; box-shadow: 0 6px 22px rgba(115,20,35,0.28); }

  .rm-trust {
    display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 14px; max-width: 760px; margin: 0 auto;
  }
  @media (max-width: 520px) { .rm-trust { grid-template-columns: 1fr; } }
  .rm-trust-item {
    display: flex; align-items: center; gap: 14px;
    background: var(--warm-white);
    border: 1px solid var(--border);
    border-top: 2px solid var(--blood);
    border-radius: 4px;
    padding: 18px 20px;
    text-align: left;
  }
  .rm-trust-icon {
    display: inline-flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    width: 42px; height: 42px;
    border-radius: 50%;
    background: rgba(115,20,35,0.07);
    border: 1px solid rgba(115,20,35,0.22);
    color: var(--blood);
  }
  .rm-trust-title {
    font-family: 'Playfair', Georgia, serif;
    font-size: 17px; font-weight: 600; color: var(--ink);
    line-height: 1.2; margin-bottom: 2px;
  }
  .rm-trust-sub { font-size: 12.5px; color: var(--ink-soft); }

  /* ── ROOMS STEP ── */
  .rm-section-header { margin-bottom: 28px; }
  .rm-section-header h2 {
    font-family: 'Playfair', serif;
    font-size: 36px; font-weight: 500; color: var(--ink);
    margin-bottom: 6px;
  }
  .rm-section-header p { font-size: 14px; color: var(--ink-soft); }

  .rm-rooms-list { display: flex; flex-direction: column; gap: 0; }

  .rm-room-card {
    background: var(--warm-white);
    border: 1px solid var(--border);
    border-radius: 16px;
    overflow: hidden;
    transition: border-color 0.2s, box-shadow 0.2s;
    margin-bottom: 20px;
  }
  .rm-room-card:hover { border-color: var(--border-strong); box-shadow: 0 8px 40px rgba(26,20,16,0.09); }

  .rm-room-top {
    display: grid;
    grid-template-columns: 300px 1fr auto;
  }
  @media (max-width: 680px) {
    .rm-room-top { grid-template-columns: 1fr; }
  }

  .rm-room-img {
    aspect-ratio: 4/3;
    object-fit: cover;
    width: 100%; height: 100%;
    display: block;
  }
  @media (max-width: 680px) { .rm-room-img { max-height: 220px; } }

  .rm-room-info { padding: 24px; }
  .rm-room-building {
    font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase;
    color: var(--gold); font-weight: 500; margin-bottom: 6px;
  }
  .rm-room-name {
    font-family: 'Playfair', serif;
    font-size: 26px; font-weight: 500; color: var(--ink);
    margin-bottom: 12px; line-height: 1.1;
  }
  .rm-room-badges { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
  .rm-badge {
    display: inline-flex; align-items: center; gap: 5px;
    background: var(--cream); border: 1px solid var(--border);
    border-radius: 20px; padding: 4px 10px;
    font-size: 12px; color: var(--ink-mid);
  }
  .rm-room-desc { font-size: 13px; color: var(--ink-soft); line-height: 1.6; }

  .rm-room-cta {
    padding: 24px;
    border-left: 1px solid var(--border);
    display: flex; flex-direction: column;
    align-items: flex-end; justify-content: space-between;
    gap: 16px; min-width: 160px;
  }
  @media (max-width: 680px) {
    .rm-room-cta {
      border-left: none; border-top: 1px solid var(--border);
      flex-direction: row; align-items: center;
      padding: 16px 24px;
    }
  }
  .rm-price-from { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-soft); }
  .rm-price-amount {
    font-family: 'Playfair', serif;
    font-size: 34px; font-weight: 500; color: var(--ink);
    line-height: 1;
  }
  .rm-btn-select {
    background: linear-gradient(180deg, var(--blood-light) 0%, var(--blood) 100%);
    color: #fff;
    border: none; border-radius: 8px;
    padding: 12px 24px;
    font-size: 13px; font-weight: 600; letter-spacing: 0.05em;
    text-transform: uppercase;
    cursor: pointer;
    transition: background 0.2s, box-shadow 0.2s;
    font-family: 'Noto Sans', sans-serif;
    white-space: nowrap;
  }
  .rm-btn-select:hover { background: linear-gradient(180deg, var(--blood) 0%, var(--blood-dark) 100%); color: #fff; box-shadow: 0 6px 18px rgba(115,20,35,0.26); }

  /* Extras dentro de la habitación */
  .rm-room-extras {
    border-top: 1px solid var(--border);
    padding: 0 24px 24px;
  }
  .rm-extras-toggle {
    width: 100%;
    background: none;
    border: none;
    border-bottom: 1px solid var(--border);
    padding: 16px 0;
    display: flex; align-items: center; justify-content: space-between;
    cursor: pointer;
    font-family: 'Noto Sans', sans-serif;
    color: var(--ink-mid); font-size: 13px; font-weight: 500;
  }
  .rm-extras-toggle:hover { color: var(--gold-dark); }

  .rm-extras-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 10px;
    padding-top: 16px;
  }

  .rm-extra-item {
    border: 1.5px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
    transition: border-color 0.15s;
    cursor: pointer;
    background: var(--warm-white);
  }
  .rm-extra-item.selected { border-color: rgba(115,20,35,0.35); background: rgba(115,20,35,0.03); box-shadow: 0 0 0 1px rgba(115,20,35,0.12); }
  .rm-extra-img { width: 100%; height: 90px; object-fit: cover; display: block; }
  .rm-extra-body { padding: 10px 12px; }
  .rm-extra-name { font-size: 13px; font-weight: 500; color: var(--ink); margin-bottom: 2px; line-height: 1.3; }
  .rm-extra-desc { font-size: 11px; color: var(--ink-soft); line-height: 1.4; margin-bottom: 8px; }
  .rm-extra-footer { display: flex; align-items: center; justify-content: space-between; }
  .rm-extra-price { font-family: 'Playfair', serif; font-size: 18px; font-weight: 500; color: var(--gold-dark); }
  .rm-extra-qty { display: flex; align-items: center; gap: 6px; }
  .rm-qty-btn {
    width: 26px; height: 26px; border-radius: 50%;
    border: 1px solid var(--border-strong);
    background: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    color: var(--ink-mid); transition: background 0.15s;
    font-family: 'Noto Sans', sans-serif;
    font-size: 14px; line-height: 1;
  }
  .rm-qty-btn:hover { background: var(--gold); border-color: var(--gold); color: #fff; }
  .rm-qty-val { font-size: 14px; font-weight: 500; min-width: 18px; text-align: center; color: var(--ink); }

  /* Jacuzzi toggle en detail */
  .rm-jacuzzi-toggle {
    display: flex; align-items: center; justify-content: space-between;
    background: var(--cream); border: 1px solid var(--border);
    border-radius: 10px; padding: 14px 18px; margin-bottom: 24px;
  }

  /* ── LAYOUT CON SIDEBAR ── */
  .rm-layout { display: grid; grid-template-columns: 1fr 340px; gap: 32px; align-items: start; }
  @media (max-width: 860px) { .rm-layout { grid-template-columns: 1fr; } }

  /* Form card */
  .rm-card {
    background: var(--warm-white);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 32px;
  }
  .rm-card h2 {
    font-family: 'Playfair', serif;
    font-size: 28px; font-weight: 500; color: var(--ink);
    margin-bottom: 24px;
  }

  .rm-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  @media (max-width: 600px) { .rm-form-grid { grid-template-columns: 1fr; } }
  .rm-form-full { grid-column: 1 / -1; }

  .rm-check-row {
    display: flex; align-items: flex-start; gap: 10px;
    cursor: pointer; padding: 4px 0;
  }
  .rm-check-row span { font-size: 13px; color: var(--ink-mid); line-height: 1.5; }

  /* Summary sidebar */
  .rm-summary {
    background: var(--ink);
    color: #fff;
    border-radius: 16px;
    padding: 28px;
    position: sticky; top: 80px;
  }
  .rm-summary-room-img { width: 100%; height: 140px; object-fit: cover; border-radius: 10px; margin-bottom: 16px; }
  .rm-summary-label {
    font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--gold-light); font-weight: 500;
  }
  .rm-summary-name {
    font-family: 'Playfair', serif;
    font-size: 22px; color: #fff; margin: 4px 0 16px;
  }
  .rm-summary-row {
    display: flex; justify-content: space-between;
    font-size: 13px; color: rgba(255,255,255,0.6);
    padding: 5px 0;
  }
  .rm-summary-row-val { color: rgba(255,255,255,0.9); }
  .rm-summary-divider { border: none; border-top: 1px solid rgba(255,255,255,0.12); margin: 12px 0; }
  .rm-summary-total {
    display: flex; justify-content: space-between;
    font-size: 15px; font-weight: 500; color: #fff;
    padding: 6px 0;
  }
  .rm-summary-total-val {
    font-family: 'Playfair', serif;
    font-size: 26px; color: var(--gold-light);
  }
  .rm-summary-deposit {
    font-size: 12px; color: rgba(255,255,255,0.45);
    margin-top: 6px; text-align: right;
  }

  /* Payment step */
  .rm-payment-box {
    background: var(--cream);
    border: 1px solid var(--border);
    border-radius: 12px; padding: 20px; margin-bottom: 20px;
  }
  .rm-payment-row { display: flex; justify-content: space-between; font-size: 14px; padding: 6px 0; color: var(--ink-mid); }
  .rm-payment-row-val { font-weight: 500; color: var(--ink); }
  .rm-payment-highlight {
    display: flex; justify-content: space-between; align-items: baseline;
    padding: 8px 0 0; border-top: 1px solid var(--border); margin-top: 4px;
    font-weight: 500;
  }
  .rm-payment-amount {
    font-family: 'Playfair', serif;
    font-size: 32px; color: var(--gold-dark);
  }
  .rm-demo-notice {
    background: rgba(115,20,35,0.06); border: 1px solid var(--border);
    border-radius: 8px; padding: 12px 14px;
    font-size: 12px; color: var(--gold-dark); margin-bottom: 20px;
  }

  /* Done */
  .rm-done {
    text-align: center; max-width: 480px; margin: 60px auto; padding: 0 16px;
  }
  .rm-done-icon {
    width: 72px; height: 72px; border-radius: 50%;
    background: rgba(115,20,35,0.10); border: 1px solid var(--border);
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto 24px;
    color: var(--gold);
  }
  .rm-done h2 {
    font-family: 'Playfair', serif;
    font-size: 42px; font-weight: 500; color: var(--ink); margin-bottom: 14px;
  }
  .rm-done p { font-size: 15px; color: var(--ink-soft); line-height: 1.65; margin-bottom: 8px; }
  .rm-done-ref { font-size: 12px; color: var(--ink-soft); margin-top: 4px; letter-spacing: 0.06em; }

  /* Back button */
  .rm-back {
    background: none; border: 1px solid rgba(255,255,255,0.2);
    color: rgba(255,255,255,0.7); border-radius: 7px;
    padding: 6px 14px; font-size: 12px; cursor: pointer;
    margin-left: auto;
    font-family: 'Noto Sans', sans-serif;
    transition: border-color 0.15s, color 0.15s;
  }
  .rm-back:hover { border-color: var(--gold-light); color: var(--gold-light); }

  /* Continue btn in layout */
  .rm-btn-continue {
    width: 100%;
    background: linear-gradient(180deg, var(--blood-light) 0%, var(--blood) 100%); color: #fff;
    border: none; border-radius: 10px;
    height: 52px;
    font-size: 13px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;
    cursor: pointer; transition: background 0.2s, box-shadow 0.2s;
    display: flex; align-items: center; justify-content: center; gap: 8px;
    font-family: 'Noto Sans', sans-serif;
    margin-top: 20px;
  }
  .rm-btn-continue:hover { background: linear-gradient(180deg, var(--blood) 0%, var(--blood-dark) 100%); color: #fff; box-shadow: 0 6px 22px rgba(115,20,35,0.28); }
  .rm-btn-continue:disabled { opacity: 0.5; cursor: not-allowed; }

  /* Building select */
  .rm-building-select {
    display: flex; align-items: center; gap: 10px;
    background: var(--warm-white);
    border: 1px solid var(--border-strong);
    border-radius: 10px; padding: 10px 14px;
    cursor: pointer; width: 100%;
    font-family: 'Noto Sans', sans-serif; font-size: 14px; color: var(--ink);
    appearance: none; -webkit-appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23731423' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 12px center;
    padding-right: 32px;
    transition: border-color 0.15s;
  }
  .rm-building-select:focus { outline: none; border-color: var(--gold); }
  .rm-building-select:hover:not(:disabled) { border-color: var(--gold); }
  .rm-building-select:disabled { opacity: 0.5; cursor: not-allowed; }

  /* Unavailable room overlay */
  .rm-room-card.rm-unavailable { opacity: 1; pointer-events: none; }
  .rm-room-card.rm-unavailable .rm-room-img { filter: grayscale(60%); }
  .rm-room-card.rm-unavailable .rm-room-name,
  .rm-room-card.rm-unavailable .rm-room-desc { opacity: 0.5; }
  .rm-room-card.rm-unavailable .rm-room-cta { opacity: 0.4; }
  .rm-unavailable-overlay {
    position: absolute; inset: 0;
    background: rgba(250,247,242,0.6);
    display: flex; align-items: center; justify-content: center;
    border-radius: 16px;
  }
  .rm-unavailable-pill {
    background: var(--ink); color: #fff;
    border-radius: 30px; padding: 8px 20px;
    font-size: 13px; font-weight: 500; letter-spacing: 0.04em;
    display: flex; align-items: center; gap: 7px;
  }


  /* Footer */
  .rm-footer {
    background: var(--ink); color: rgba(255,255,255,0.55);
    border-top: 2px solid var(--blood);
  }
  .rm-footer-inner {
    max-width: 1100px; margin: 0 auto;
    padding: 48px 24px 32px;
    display: grid;
    grid-template-columns: 1.4fr 1fr 1fr;
    gap: 40px;
  }
  @media (max-width: 760px) {
    .rm-footer-inner { grid-template-columns: 1fr; gap: 32px; text-align: center; }
  }
  .rm-footer-logo { height: 40px; width: auto; margin-bottom: 18px; }
  @media (max-width: 760px) { .rm-footer-logo { margin-inline: auto; } }
  .rm-footer-about { font-size: 13px; line-height: 1.7; color: rgba(255,255,255,0.55); max-width: 320px; }
  @media (max-width: 760px) { .rm-footer-about { margin-inline: auto; } }
  .rm-footer-col h4 {
    font-family: 'Playfair', serif;
    font-size: 17px; font-weight: 600; letter-spacing: 0.04em;
    color: var(--gold-light); margin-bottom: 14px;
  }
  .rm-footer-col p { font-size: 13px; line-height: 1.6; margin-bottom: 8px; color: rgba(255,255,255,0.6); }
  .rm-footer-col a { color: rgba(255,255,255,0.78); text-decoration: none; transition: color 0.15s; }
  .rm-footer-col a:hover { color: var(--gold-light); }
  .rm-footer-social { display: flex; gap: 10px; margin-bottom: 24px; }
  @media (max-width: 760px) { .rm-footer-social { justify-content: center; } }
  .rm-footer-social a {
    width: 34px; height: 34px; border-radius: 50%;
    border: 1px solid rgba(255,255,255,0.16);
    display: flex; align-items: center; justify-content: center;
    transition: border-color 0.15s, background 0.15s;
  }
  .rm-footer-social a:hover { border-color: var(--gold); background: rgba(115,20,35,0.18); }
  .rm-footer-social img { width: 16px; height: 16px; object-fit: contain; }
  .rm-footer-bottom {
    border-top: 1px solid rgba(255,255,255,0.08);
    text-align: center; padding: 18px 24px;
    font-size: 12px; line-height: 1.7; color: rgba(255,255,255,0.4);
  }
  .rm-footer-bottom strong { color: var(--gold-light); }

  /* Decoration message inputs */
  .rm-deco-msg {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px dashed var(--border);
    display: flex; flex-direction: column; gap: 10px;
  }
  .rm-deco-msg-field { display: flex; flex-direction: column; gap: 4px; }
  .rm-deco-msg-label {
    font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase;
    font-weight: 500; color: var(--gold-dark);
  }
  .rm-deco-msg-input {
    width: 100%;
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 13px;
    font-family: 'Noto Sans', sans-serif;
    color: var(--ink);
    background: var(--warm-white);
  }
  .rm-deco-msg-input:focus { outline: none; border-color: var(--gold); }
  .rm-deco-msg-input.rm-invalid { border-color: #c0392b; background: rgba(192,57,43,0.05); }
  .rm-deco-msg-hint { font-size: 10px; color: var(--ink-soft); }
  .rm-deco-msg-hint.rm-over { color: #c0392b; }
`;

function defaultTime(): string {
  const now = new Date();
  const totalMin = now.getHours() * 60 + now.getMinutes();
  const rounded = Math.ceil(totalMin / 15) * 15;
  const h = Math.floor(rounded / 60) % 24;
  const m = rounded % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────
export function PublicReservePage({ initialSlug }: { initialSlug?: string } = {}) {
  // When reached via a shareable per-room URL (/reservar-<slug>), preselect that
  // room's building and feature the room at the top of the list.
  const initialEntry = useMemo(() => roomForSlug(initialSlug), [initialSlug]);
  const appliedSlugRef = useRef(false);
  const [featuredName, setFeaturedName] = useState<string | null>(initialEntry?.name ?? null);

  const [step, setStep] = useState<Step>("search");

  // search
  const [date, setDate] = useState("");
  const [time, setTime] = useState(defaultTime);
  const [duration, setDuration] = useState(120);
  const [isOvernight, setIsOvernight] = useState(false);
  const [people, setPeople] = useState(2);
  const [building, setBuilding] = useState<string>(initialEntry?.building ?? "bernabeu");

  // room
  const [room, setRoom] = useState<RoomLite | null>(null);
  const [withJacuzzi, setWithJacuzzi] = useState(false);
  const [expandedExtrasRoom, setExpandedExtrasRoom] = useState<string | null>(null);

  // extras (shared across rooms in search, then locked after select)
  const [extraQty, setExtraQty] = useState<Record<string, number>>({});
  // Personalised phrases per decoration extra id (bed + glass/LED screen)
  const [decoMessages, setDecoMessages] = useState<Record<string, DecoMessage>>({});
  // Discount code: the debug code (DEBUG_DISCOUNT_CODE) or a real promo code
  // validated server-side. A promo only ever discounts the room price, never the
  // extras. `debug` marks the −99,9% test code which discounts the whole total.
  const [discountInput, setDiscountInput] = useState("");
  const [promo, setPromo] = useState<AppliedPromo | null>(null);

  // customer
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [adult, setAdult] = useState(false);
  const [noContact, setNoContact] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  const [breakdown, setBreakdown] = useState<PriceBreakdown | null>(null);
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [didSearch, setDidSearch] = useState(false);
  const roomsRef = useRef<HTMLDivElement>(null);
  const isFirstHistoryEntry = useRef(true);
  const handlingPop = useRef(false);
  const payingGuard = useRef(false);

  const startAt = useMemo(
    () => (date && time ? new Date(`${date}T${time}:00`) : null),
    [date, time],
  );
  // Overnight requires both an eligible entry day and a room that allows it.
  const roomAllowsOvernight = room?.allows_overnight !== false;
  const dayAllowsOvernight = startAt ? isOvernightAllowed(startAt) : false;
  const overnightAllowed = dayAllowsOvernight && roomAllowsOvernight;

  // Never keep an overnight selection on a room/day that doesn't allow it
  // (e.g. after switching to an hourly-only room).
  useEffect(() => {
    if (isOvernight && !overnightAllowed) setIsOvernight(false);
  }, [isOvernight, overnightAllowed]);

  // Noche completa solo admite 2 personas: si venía de una búsqueda por horas
  // con 3/4, lo reseteamos a 2 al activar la noche completa.
  useEffect(() => {
    if (isOvernight && people !== 2) setPeople(2);
  }, [isOvernight, people]);

  const endAt = useMemo(() => {
    if (!startAt) return null;
    const e = new Date(startAt);
    if (isOvernight) {
      e.setDate(e.getDate() + 1);
      e.setHours(10, 0, 0, 0);
    } else {
      e.setMinutes(e.getMinutes() + duration);
    }
    return e;
  }, [startAt, isOvernight, duration]);

  const pricingDuration = useMemo(() => {
    const c = Math.min(360, Math.max(60, duration));
    return Math.min(360, Math.max(60, Math.ceil(c / 30) * 30));
  }, [duration]);

  const { data: rooms } = useQuery({
    queryKey: ["public-rooms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rooms")
        .select(
          "id,name,building,capacity,jacuzzi,has_tv,has_swing,rate_group_id,allows_overnight,status",
        )
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return data as RoomLite[];
    },
  });

  const { data: rateHourly } = useQuery({
    queryKey: ["public-rate-hourly"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rate_hourly").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: extras } = useQuery({
    queryKey: ["public-extras"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("extras")
        .select("id,name,description,price,category")
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return (data as ExtraLite[]).filter((e) => e.category !== "services" && Number(e.price) > 0);
    },
  });

  const fromPriceByRoom = useMemo(() => {
    const map = new Map<string, number>();
    if (!rooms || !rateHourly) return map;
    const cheapestByGroup = new Map<string, number>();
    for (const r of rateHourly as {
      rate_group_id: string;
      price_without_jacuzzi: number | null;
      price_with_jacuzzi: number | null;
    }[]) {
      const candidates = [
        Number(r.price_without_jacuzzi ?? Infinity),
        Number(r.price_with_jacuzzi ?? Infinity),
      ].filter((n) => Number.isFinite(n));
      if (!candidates.length) continue;
      const best = Math.min(...candidates);
      const cur = cheapestByGroup.get(r.rate_group_id);
      if (cur === undefined || best < cur) cheapestByGroup.set(r.rate_group_id, best);
    }
    for (const room of rooms) {
      if (room.rate_group_id) {
        const p = cheapestByGroup.get(room.rate_group_id);
        if (p !== undefined) map.set(room.id, p);
      }
    }
    return map;
  }, [rooms, rateHourly]);

  const { data: conflicts } = useQuery({
    queryKey: ["public-conflicts", startAt?.toISOString(), endAt?.toISOString()],
    enabled: !!startAt && !!endAt,
    queryFn: async () => {
      if (!startAt || !endAt) return new Set<string>();
      // Wide fetch window; precise overlap (with each reservation's cleaning
      // buffer) is computed below. Reservations need ≥ cleaning_minutes of
      // cleaning after they end before the room is reservable again.
      const WINDOW_MS = 12 * 60 * 60_000;
      const NEW_CLEANING_MIN = 15; // public bookings use the default buffer
      const sixtyMinutesAgo = Date.now() - 60 * 60_000;
      const { data, error } = await supabase
        .from("reservations")
        .select("room_id,status,created_at,start_at,end_at,cleaning_minutes")
        .gte("end_at", new Date(startAt.getTime() - WINDOW_MS).toISOString())
        .lte("start_at", new Date(endAt.getTime() + WINDOW_MS).toISOString());
      if (error) throw error;
      const blocked = new Set<string>();
      const nStart = startAt.getTime();
      const nEnd = endAt.getTime() + NEW_CLEANING_MIN * 60_000;
      for (const r of data ?? []) {
        // Only confirmed/active reservations block; pending blocks only while
        // recent (abandoned public payments free the slot). Cancelled / no_show
        // / rejected never block.
        const blocks =
          r.status === "confirmed" ||
          r.status === "in_progress" ||
          r.status === "completed" ||
          (r.status === "pending" && new Date(r.created_at).getTime() > sixtyMinutesAgo);
        if (!blocks) continue;
        const rStart = new Date(r.start_at).getTime();
        const rEnd = new Date(r.end_at).getTime() + (r.cleaning_minutes ?? 15) * 60_000;
        if (rStart < nEnd && nStart < rEnd) blocked.add(r.room_id);
      }
      return blocked;
    },
  });

  useEffect(() => {
    if (!room?.rate_group_id || !startAt) {
      setBreakdown(null);
      return;
    }
    if (step !== "room-detail" && step !== "details" && step !== "payment") return;
    let cancel = false;
    const selectedExtras = Object.entries(extraQty)
      .filter(([, q]) => q > 0)
      .map(([id, q]) => {
        const ex = extras?.find((e) => e.id === id);
        if (!ex || !extraAvailableForRoom(ex, room)) return null;
        return { extraId: id, qty: q, price: Number(ex?.price ?? 0) };
      })
      .filter((e): e is { extraId: string; qty: number; price: number } => Boolean(e));
    calculatePrice({
      rateGroupId: room.rate_group_id,
      durationMin: pricingDuration,
      withJacuzzi: room.jacuzzi === "always" ? true : room.jacuzzi === "none" ? false : withJacuzzi,
      isOvernight,
      overnightCheckout: isOvernight ? "10:00:00" : undefined,
      people,
      startAt,
      extras: selectedExtras,
    })
      .then((b) => {
        if (!cancel) setBreakdown(b);
      })
      .catch(() => {
        if (!cancel) setBreakdown(null);
      });
    return () => {
      cancel = true;
    };
  }, [room, withJacuzzi, isOvernight, people, startAt, pricingDuration, extras, extraQty, step]);

  // En cada salto de página del flujo (cambio de `step`) subimos al inicio, para
  // que la nueva vista no aparezca desplazada hacia abajo tras el paso anterior.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [step]);

  const goSearch = () => {
    if (!date || !time) return toast.error("Selecciona fecha y hora");
    setRoom(null);
    setStep("search");
    setDidSearch(true);
  };

  const availableRooms = useMemo(() => {
    if (!rooms) return [];

    const filtered = rooms.filter(
      // Normalise both sides through buildingKey so accented DB values
      // ("Bernabéu", "América") still match the selected building key.
      (r) => buildingKey(r.building) === buildingKey(building),
    );

    // A featured room (reached via /reservar-<slug>) is shown first.
    if (featuredName) {
      filtered.sort((a, b) => {
        const af = a.name === featuredName ? 0 : 1;
        const bf = b.name === featuredName ? 0 : 1;
        return af - bf;
      });
    }
    return filtered;
  }, [rooms, building, featuredName]);

  // Land directly on the room when arriving via a per-room URL: preselect the
  // building and default the date so its card is shown, then scroll to it.
  useEffect(() => {
    if (appliedSlugRef.current) return;
    if (!initialEntry || !rooms) return;
    appliedSlugRef.current = true;
    setBuilding(initialEntry.building);
    setFeaturedName(initialEntry.name);
    // Do NOT pre-fill date or auto-search: the user must choose date and time
    // themselves so they don't see rooms blocked for a time they haven't picked.
  }, [initialEntry, rooms]);

  useEffect(() => {
    if (didSearch && availableRooms.length > 0) {
      roomsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      setDidSearch(false);
    }
  }, [didSearch, availableRooms.length]);

  const selectRoom = (r: RoomLite) => {
    setRoom(r);
    setWithJacuzzi(r.jacuzzi === "always");
    setExtraQty((current) => {
      if (!extras) return current;
      return Object.fromEntries(
        Object.entries(current).filter(([id]) => {
          const ex = extras.find((item) => item.id === id);
          return ex ? extraAvailableForRoom(ex, r) : true;
        }),
      );
    });
    setStep("room-detail");
  };

  // Sync step changes into browser history so the back button works
  useEffect(() => {
    if (handlingPop.current) {
      handlingPop.current = false;
      return;
    }
    if (isFirstHistoryEntry.current) {
      isFirstHistoryEntry.current = false;
      window.history.replaceState({ step }, "");
      return;
    }
    window.history.pushState({ step }, "");
  }, [step]);

  // Handle browser back/forward button
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const s = (e.state as { step?: Step } | null)?.step;
      if (!s) return;
      handlingPop.current = true;
      setStep(s);
      if (s === "search") setRoom(null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const handleBack = () => {
    if (step === "search") return;
    if (step === "room-detail") {
      setStep("search");
      setRoom(null);
    } else if (step === "details") setStep("room-detail");
    else if (step === "payment") setStep("details");
  };

  const submitDetails = () => {
    if (!customerName.trim() || !customerEmail.trim())
      return toast.error("Nombre y email obligatorios");
    if (!adult) return toast.error("Debes confirmar que eres mayor de 18 años");
    if (!acceptedTerms)
      return toast.error("Debes aceptar las condiciones de reserva y políticas de cancelación");
    setStep("payment");
  };

  // Alternative booking path: open WhatsApp with the reservation details
  // prefilled. No card payment (skips Redsys) and no DB write — reception
  // confirms the booking manually from the chat.
  const reserveViaWhatsApp = () => {
    if (!room || !startAt) return;
    const wa = WHATSAPP_NUMBERS[building];
    if (!wa) {
      toast.error("No hay WhatsApp disponible para este hotel");
      return;
    }

    const hotelLabel = BUILDINGS.find((b) => b.value === building)?.label ?? room.building;
    const fechaLarga = startAt.toLocaleDateString("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const duracion = isOvernight
      ? "Noche completa (hasta 10:00)"
      : DURATION_LABELS[pricingDuration];

    const extrasSeleccionados = Object.entries(extraQty)
      .filter(([, q]) => q > 0)
      .map(([id, q]) => {
        const ex = extras?.find((e) => e.id === id);
        return ex ? `• ${ex.name} x${q}` : null;
      })
      .filter(Boolean);

    const lines = [
      "¡Hola! Quiero reservar por WhatsApp (sin pago con tarjeta):",
      "",
      `Hotel: ${hotelLabel}`,
      `Habitación: ${room.name}`,
      `Fecha: ${fechaLarga}`,
      `Entrada: ${time}`,
      `Duración: ${duracion}`,
      `Personas: ${people}`,
      ...(extrasSeleccionados.length ? ["", "Extras:", ...extrasSeleccionados] : []),
      "",
      `Total estimado: ${eur(payableTotal)}`,
      "",
      "Mis datos:",
      `- Nombre: ${customerName || "(por indicar)"}`,
      `- Teléfono: ${customerPhone || "(por indicar)"}`,
      `- Email: ${customerEmail || "(por indicar)"}`,
    ];

    const url = `https://wa.me/${wa.intl}?text=${encodeURIComponent(lines.join("\n"))}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const createReservation = async () => {
    if (!room || !startAt || !endAt || !breakdown) return;
    // Safety net: never let an overnight stay through with a 0 € base price
    // (would happen if a room is flagged overnight-capable but its rate group
    // has no overnight rate configured).
    if (isOvernight && breakdown.base <= 0) {
      toast.error("Esta habitación no tiene tarifa de noche completa configurada.");
      return;
    }
    if (payingGuard.current) return;
    payingGuard.current = true;
    setPaying(true);
    let createdReservationId: string | null = null;
    try {
      // Re-check the room is still bookable: its manual status (out_of_service /
      // cleaning / occupied) may have changed since the page loaded. The DB
      // trigger enforces this too, but this gives the customer a clear message.
      const { data: freshRoom } = await supabase
        .from("rooms")
        .select("status")
        .eq("id", room.id)
        .maybeSingle();
      if (freshRoom && freshRoom.status !== "available") {
        toast.error("Esta habitación ya no está disponible. Por favor, elige otra.");
        setPaying(false);
        payingGuard.current = false;
        return;
      }

      // Find-or-create customer by email (SECURITY DEFINER RPC) to avoid
      // duplicate customer rows from repeated public bookings.
      const { data: customerId, error: customerErr } = await supabase.rpc(
        "find_or_create_customer" as never,
        {
          p_name: customerName,
          p_email: customerEmail,
          p_phone: customerPhone || null,
          p_no_contact: noContact,
        } as never,
      );
      if (customerErr || !customerId)
        throw customerErr ?? new Error("No se pudo registrar el cliente");

      const total = payableTotal;
      const deposit = depositAmount;
      const { data: reservation, error: rerr } = await supabase
        .from("reservations")
        .insert({
          room_id: room.id,
          customer_id: customerId as unknown as string,
          start_at: startAt.toISOString(),
          end_at: endAt.toISOString(),
          with_jacuzzi:
            room.jacuzzi === "always" ? true : room.jacuzzi === "none" ? false : withJacuzzi,
          people,
          is_overnight: isOvernight,
          base_price: breakdown.base,
          third_person_surcharge: breakdown.thirdPerson,
          dynamic_surcharge: breakdown.dynamicSurcharge,
          dynamic_reason: breakdown.dynamicReason,
          extras_total: breakdown.extrasTotal,
          total,
          deposit_amount: deposit,
          deposit_paid: false,
          status: "pending",
          manual_override: false,
          created_by_role: "public",
          promo_code_id: promo?.debug ? null : (promo?.id ?? null),
          discount_amount: discountAmount,
          internal_notes: promo?.debug
            ? "Reserva de prueba — descuento debug −99,9%"
            : promo
              ? `Código ${promo.code} aplicado (−${eur(discountAmount)} sobre habitación)`
              : null,
        })
        .select("id")
        .single();
      if (rerr) throw rerr;
      createdReservationId = reservation.id;

      const rows = Object.entries(extraQty)
        .filter(([, q]) => q > 0)
        .map(([extraId, qty]) => {
          const ex = extras?.find((e) => e.id === extraId);
          if (!ex || !extraAvailableForRoom(ex, room)) return null;
          const msg = ex && decorationNeedsMessage(ex) ? decoMessages[extraId] : undefined;
          return {
            reservation_id: reservation.id,
            extra_id: extraId,
            qty,
            unit_price: Number(ex?.price ?? 0),
            is_gift: false,
            bed_message: msg?.bed.trim() || null,
            screen_message: msg?.screen.trim() || null,
          };
        })
        .filter(
          (
            row,
          ): row is {
            reservation_id: string;
            extra_id: string;
            qty: number;
            unit_price: number;
            is_gift: boolean;
            bed_message: string | null;
            screen_message: string | null;
          } => Boolean(row),
        );
      for (const giftId of breakdown.giftedExtraIds) {
        if (!rows.some((r) => r.extra_id === giftId))
          rows.push({
            reservation_id: reservation.id,
            extra_id: giftId,
            qty: 1,
            unit_price: 0,
            is_gift: true,
            bed_message: null,
            screen_message: null,
          });
      }
      if (rows.length > 0) await supabase.from("reservation_extras").insert(rows);

      // Initiate Redsys payment — edge function returns signed form fields
      const { data: redsysData, error: redsysErr } = await supabase.functions.invoke(
        "create-redsys-payment",
        { body: { reservation_id: reservation.id } },
      );
      if (redsysErr) {
        let msg = "Error al procesar el pago";
        try {
          // FunctionsHttpError.context is the raw Response (body not yet consumed)
          const ctx = (redsysErr as any).context;
          if (ctx?.json) {
            const body = await ctx.json();
            msg = body?.error ?? body?.message ?? msg;
          } else if ((redsysErr as any).message) {
            msg = (redsysErr as any).message;
          }
        } catch {
          /* ignore */
        }
        console.error("[pago] error de edge function:", redsysErr);
        throw new Error(msg);
      }
      // Bypass mode: edge function marked the reservation as paid directly
      if (redsysData?.bypass) {
        window.location.href = redsysData.redirectUrl ?? "/";
        return;
      }

      if (!redsysData?.action || !redsysData?.formFields) {
        throw new Error("Respuesta inesperada del servidor de pagos");
      }

      // Auto-submit form to Redsys TPV (browser navigates away)
      const form = document.createElement("form");
      form.method = "POST";
      form.action = redsysData.action;
      form.style.display = "none";
      for (const [name, value] of Object.entries(redsysData.formFields as Record<string, string>)) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.appendChild(input);
      }
      document.body.appendChild(form);
      form.submit();
      // Note: setPaying(false) intentionally omitted — browser navigates away
    } catch (e: any) {
      if (createdReservationId) {
        await supabase
          .from("reservation_extras")
          .delete()
          .eq("reservation_id", createdReservationId);
        await supabase.from("reservations").delete().eq("id", createdReservationId);
      }
      const msg =
        e?.message ?? e?.details ?? e?.hint ?? JSON.stringify(e) ?? "Error al procesar el pago";
      console.error("[pago] excepción en createReservation:", e);
      toast.error(msg);
      setPaying(false);
      payingGuard.current = false;
    }
  };

  const currentStepIdx = STEP_INDEX[step] ?? 0;

  // Room subtotal a promo code can discount — extras are always excluded.
  const roomSubtotal = useMemo(
    () =>
      breakdown ? round2(breakdown.base + breakdown.thirdPerson + breakdown.dynamicSurcharge) : 0,
    [breakdown],
  );

  // Euros knocked off by the applied code. The debug code discounts the whole
  // total (to test the TPV with a ~0,01 € deposit); real promos only the room.
  const discountAmount = useMemo(() => {
    if (!breakdown || !promo) return 0;
    if (promo.debug) return round2(breakdown.total * DEBUG_DISCOUNT_PCT);
    return discountEurosForRoom(
      { discount_type: promo.type, discount_value: promo.value },
      roomSubtotal,
    );
  }, [breakdown, promo, roomSubtotal]);

  // Total actually charged, after any discount code, and the 30% deposit taken
  // online (floored at the Redsys minimum when a debug discount is active).
  const payableTotal = useMemo(
    () => (breakdown ? round2(Math.max(0, breakdown.total - discountAmount)) : 0),
    [breakdown, discountAmount],
  );
  const depositAmount = useMemo(() => {
    const d = round2(payableTotal * 0.3);
    return promo?.debug ? Math.max(REDSYS_MIN_EUR, d) : d;
  }, [payableTotal, promo]);

  const applyDiscount = async () => {
    const code = discountInput.trim().toUpperCase();
    if (!code) return;
    if (code === DEBUG_DISCOUNT_CODE) {
      setPromo({ id: null, code, type: "percent", value: DEBUG_DISCOUNT_PCT * 100, debug: true });
      toast.success("Código aplicado (debug −99,9%)");
      return;
    }
    const { data, error } = await supabase.rpc("validate_promo_code", { p_code: code });
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) {
      setPromo(null);
      toast.error("Código no válido o caducado");
      return;
    }
    setPromo({
      id: row.id,
      code: row.code,
      type: row.discount_type as DiscountType,
      value: Number(row.discount_value),
    });
    toast.success("Código aplicado");
  };

  const extrasTotalSelected = useMemo(() => {
    return Object.entries(extraQty).reduce((s, [id, q]) => {
      const ex = extras?.find((e) => e.id === id);
      if (!ex || (room && !extraAvailableForRoom(ex, room))) return s;
      return s + q * Number(ex?.price ?? 0);
    }, 0);
  }, [extraQty, extras, room]);

  const changeQty = (id: string, delta: number) =>
    setExtraQty((p) => ({ ...p, [id]: Math.max(0, (p[id] ?? 0) + delta) }));

  const setDecoMessage = (id: string, field: keyof DecoMessage, value: string) =>
    setDecoMessages((p) => {
      const cur = p[id] ?? { bed: "", screen: "" };
      return { ...p, [id]: { ...cur, [field]: value } };
    });

  // Decorations the customer has actually added that require phrases
  const selectedDecoNeedingMessage = useMemo(
    () =>
      (extras ?? []).filter(
        (e) =>
          decorationNeedsMessage(e) &&
          (extraQty[e.id] ?? 0) > 0 &&
          (!room || extraAvailableForRoom(e, room)),
      ),
    [extras, extraQty, room],
  );

  // Returns an error message if any required phrase is missing or too long
  const validateDecoMessages = (): string | null => {
    for (const ex of selectedDecoNeedingMessage) {
      const m = decoMessages[ex.id] ?? { bed: "", screen: "" };
      const surfaceLabel = room ? messageSurfaceLabel(room).toLowerCase() : "mensaje en el cristal";
      if (!m.bed.trim() || !m.screen.trim())
        return `Escribe la frase de la cama y el ${surfaceLabel} para «${ex.name}»`;
      if (countWords(m.bed) > BED_MESSAGE_MAX_WORDS)
        return `La frase en la cama de «${ex.name}» admite máximo ${BED_MESSAGE_MAX_WORDS} palabras`;
      if (countWords(m.screen) > SCREEN_MESSAGE_MAX_WORDS)
        return `El ${surfaceLabel} de «${ex.name}» admite máximo ${SCREEN_MESSAGE_MAX_WORDS} palabras`;
    }
    return null;
  };

  // Inputs shown under a decoration card once it has been added to the order
  const renderDecoMessageInputs = (
    ex: ExtraLite,
    contextRoom?: { name: string; building: string } | null,
  ) => {
    if (!decorationNeedsMessage(ex) || (extraQty[ex.id] ?? 0) <= 0) return null;
    const m = decoMessages[ex.id] ?? { bed: "", screen: "" };
    const bedOver = countWords(m.bed) > BED_MESSAGE_MAX_WORDS;
    const screenOver = countWords(m.screen) > SCREEN_MESSAGE_MAX_WORDS;
    const effectiveRoom = contextRoom ?? room;
    const surfaceLabel = effectiveRoom
      ? messageSurfaceLabel(effectiveRoom)
      : "Mensaje en el cristal";
    return (
      <div className="rm-deco-msg" onClick={(e) => e.stopPropagation()}>
        <div className="rm-deco-msg-field">
          <label className="rm-deco-msg-label">
            Frase en la cama (máx. {BED_MESSAGE_MAX_WORDS} palabras) *
          </label>
          <input
            className={`rm-deco-msg-input${bedOver ? " rm-invalid" : ""}`}
            value={m.bed}
            maxLength={40}
            placeholder="Ej. Te amo"
            onChange={(e) => setDecoMessage(ex.id, "bed", e.target.value)}
          />
          {bedOver && (
            <span className="rm-deco-msg-hint rm-over">
              Máximo {BED_MESSAGE_MAX_WORDS} palabras
            </span>
          )}
        </div>
        <div className="rm-deco-msg-field">
          <label className="rm-deco-msg-label">
            {surfaceLabel} (máx. {SCREEN_MESSAGE_MAX_WORDS} palabras) *
          </label>
          <input
            className={`rm-deco-msg-input${screenOver ? " rm-invalid" : ""}`}
            value={m.screen}
            maxLength={120}
            placeholder="Ej. Feliz aniversario mi amor"
            onChange={(e) => setDecoMessage(ex.id, "screen", e.target.value)}
          />
          {screenOver && (
            <span className="rm-deco-msg-hint rm-over">
              Máximo {SCREEN_MESSAGE_MAX_WORDS} palabras
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="rm-page">
      <PublicAnalytics />
      <style>{CSS}</style>

      {/* Age banner */}
      <div className="rm-age-banner">
        <ShieldCheck size={14} />
        Reservas exclusivas para mayores de 18 años · Solo adultos
      </div>

      {/* Header — menú del sitio (roomsmadrid.es) + controles del flujo */}
      <SiteHeader
        booking={{
          showBack: step !== "search" && step !== "done",
          onBack: handleBack,
          phone: CONTACTS[building]?.phones[0] ?? {
            number: "91 007 61 00",
            href: "tel:+34910076100",
          },
        }}
      />

      {/* Step indicator */}
      {step !== "done" && (
        <div className="rm-steps">
          <div className="rm-steps-inner">
            {STEPS.map((s, i) => (
              <div key={s.key} style={{ display: "contents" }}>
                <div
                  className={`rm-step ${i === currentStepIdx ? "active" : i < currentStepIdx ? "done" : ""}`}
                >
                  <div className="rm-step-num">{i < currentStepIdx ? "✓" : i + 1}</div>
                  <span>{s.label}</span>
                </div>
                {i < STEPS.length - 1 && <div className="rm-step-sep" />}
              </div>
            ))}
          </div>
        </div>
      )}

      <main className="rm-main">
        {/* ── STEP 1: SEARCH ── */}
        {step === "search" && (
          <section>
            <div className="rm-hero">
              <div className="rm-hero-eyebrow">
                <Star size={12} />
                Madrid · Habitaciones temáticas
                <Star size={12} />
              </div>
              <h1 className="rm-serif">
                Tu escapada <em>perfecta</em>
                <br />
                empieza aquí
              </h1>
              <p>
                Habitaciones únicas con jacuzzi en el centro de Madrid. Sin registro, con
                confirmación inmediata.
              </p>
            </div>

            <div className="rm-search-card">
              <div className="rm-search-grid">
                <div className="rm-field">
                  <label className="rm-label">Fecha</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
                        {date || <span className="text-muted-foreground">Selecciona fecha</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={date ? new Date(`${date}T00:00:00`) : undefined}
                        onSelect={(d) => setDate(d ? format(d, "yyyy-MM-dd") : "")}
                        disabled={(d) => d < new Date(new Date().toDateString())}
                        contactPhones={CONTACTS[building]?.phones}
                        restrictContactDays
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="rm-field">
                  <label
                    className="rm-label"
                    style={{ display: "flex", alignItems: "center", gap: 5 }}
                  >
                    <MapPin size={11} />
                    Localización
                  </label>
                  <select
                    className="rm-building-select"
                    value={building}
                    onChange={(e) => setBuilding(e.target.value)}
                  >
                    {BUILDINGS.map((b) => (
                      <option key={b.value} value={b.value}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                  {building !== "all" && (
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--ink-soft)",
                        marginTop: 4,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <MapPin size={10} />
                      {BUILDINGS.find((b) => b.value === building)?.address}
                    </div>
                  )}
                </div>

                <div className="rm-field">
                  <label className="rm-label">Hora de entrada</label>
                  <select
                    className="rm-building-select"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                  >
                    {isOvernight
                      ? Array.from({ length: 8 }, (_, i) => {
                          const totalMin = 22 * 60 + i * 15;
                          const hh = String(Math.floor(totalMin / 60)).padStart(2, "0");
                          const mm = String(totalMin % 60).padStart(2, "0");
                          const val = `${hh}:${mm}`;
                          return (
                            <option key={val} value={val}>
                              {val}
                            </option>
                          );
                        })
                      : Array.from({ length: 96 }, (_, i) => {
                          const totalMin = i * 15;
                          const hh = String(Math.floor(totalMin / 60)).padStart(2, "0");
                          const mm = String(totalMin % 60).padStart(2, "0");
                          const val = `${hh}:${mm}`;
                          return (
                            <option key={val} value={val}>
                              {val}
                            </option>
                          );
                        })}
                  </select>
                </div>

                <div className="rm-overnight-row">
                  <div>
                    <div className="rm-overnight-row-label">
                      <Moon
                        size={14}
                        style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }}
                      />
                      Noche completa
                    </div>
                    <div className="rm-overnight-row-sub">
                      {!roomAllowsOvernight
                        ? "Esta habitación solo se reserva por horas"
                        : overnightAllowed
                          ? "Disponible dom–mié · 22:00 – 10:00"
                          : "Solo dom–mié · 22:00 – 10:00"}
                    </div>
                  </div>
                  <Switch
                    checked={isOvernight}
                    onCheckedChange={(v) => {
                      setIsOvernight(v);
                      if (v && time < "22:00") setTime("22:00");
                    }}
                    disabled={!overnightAllowed}
                  />
                </div>

                {!isOvernight && (
                  <div className="rm-field">
                    <label className="rm-label">Duración</label>
                    <select
                      className="rm-building-select"
                      value={String(duration)}
                      onChange={(e) => setDuration(Number(e.target.value))}
                    >
                      {DURATIONS.map((d) => (
                        <option key={d} value={String(d)}>
                          {DURATION_LABELS[d]}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="rm-field">
                  <label className="rm-label">Personas</label>
                  <select
                    className="rm-building-select"
                    value={String(people)}
                    onChange={(e) => setPeople(Number(e.target.value))}
                  >
                    {/* Noche completa: solo 2 personas (no hay suplemento 3ª/4ª
                        persona en tarifa de noche). Por horas: 2, 3 o 4. */}
                    {(isOvernight ? [2] : [2, 3, 4]).map((n) => (
                      <option key={n} value={String(n)}>
                        {n} personas
                      </option>
                    ))}
                  </select>
                </div>

                <button className="rm-btn-primary" onClick={goSearch} disabled={!date || !time}>
                  Ver habitaciones disponibles <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Available rooms list (shown after date selected) */}
            {date && availableRooms.length > 0 && (
              <div ref={roomsRef} style={{ marginTop: 40 }}>
                <div className="rm-section-header">
                  <h2 className="rm-serif">Habitaciones disponibles</h2>
                  <p>
                    {startAt?.toLocaleDateString("es-ES", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                    {" · "}
                    {time}
                    {" · "}
                    {isOvernight ? "Noche completa" : DURATION_LABELS[pricingDuration]}
                    {" · "}
                    {people} {people === 1 ? "persona" : "personas"}
                  </p>
                </div>

                <div className="rm-rooms-list">
                  {availableRooms.map((r) => {
                    const fromPrice = fromPriceByRoom.get(r.id);
                    // A room is unavailable for booking when it has a time conflict
                    // with an existing reservation OR when staff set its manual
                    // status to anything other than "available" (ocupada, limpieza,
                    // fuera de servicio) in the admin panel.
                    const statusBlocked = r.status !== "available";
                    const unavailable = conflicts?.has(r.id) || statusBlocked;
                    // Rooms flagged hourly-only are greyed out while the overnight
                    // option is active (they can only be booked by the hour).
                    const overnightBlocked = isOvernight && r.allows_overnight === false;
                    const blocked = unavailable || overnightBlocked;
                    const isExpanded = expandedExtrasRoom === r.id;
                    const roomExtras =
                      extras?.filter(
                        (e) => e.category !== "services" && extraAvailableForRoom(e, r),
                      ) ?? [];
                    const selectedInRoom = roomExtras.filter((e) => (extraQty[e.id] ?? 0) > 0);

                    return (
                      <div
                        key={r.id}
                        className={`rm-room-card${blocked ? " rm-unavailable" : ""}`}
                        style={{
                          position: "relative",
                          ...(featuredName && r.name === featuredName && !blocked
                            ? { boxShadow: "0 0 0 2px var(--gold)" }
                            : {}),
                        }}
                      >
                        {blocked && (
                          <div className="rm-unavailable-overlay">
                            <div
                              className="rm-unavailable-pill"
                              style={{
                                flexDirection: "column",
                                alignItems: "center",
                                gap: 6,
                                padding: "12px 20px",
                                textAlign: "center",
                              }}
                            >
                              {unavailable ? (
                                <>
                                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                    <span style={{ fontSize: 16 }}>🔒</span>
                                    {statusBlocked && !conflicts?.has(r.id)
                                      ? "No está disponible en este momento"
                                      : "No disponible para este horario"}
                                  </div>
                                  <div
                                    style={{
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: 2,
                                      fontSize: 12,
                                      opacity: 0.85,
                                    }}
                                  >
                                    {CONTACTS[buildingKey(r.building)]?.phones.map((p, i) => (
                                      <a
                                        key={i}
                                        href={p.href}
                                        style={{
                                          color: "var(--gold-light)",
                                          textDecoration: "none",
                                          fontWeight: 500,
                                        }}
                                      >
                                        {p.number}
                                      </a>
                                    ))}
                                  </div>
                                </>
                              ) : (
                                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                  <span style={{ fontSize: 16 }}>🕑</span>
                                  Esta habitación solo puede reservarse por horas
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        <div className="rm-room-top">
                          <div className="rm-room-img" style={{ padding: 0 }}>
                            <RoomImageCarousel
                              images={getRoomImages(r)}
                              alt={r.name}
                              height="100%"
                              className="rm-room-img"
                            />
                          </div>
                          <div className="rm-room-info">
                            <div className="rm-room-building">RM {r.building}</div>
                            <div className="rm-room-name rm-serif">{r.name}</div>
                            <div className="rm-room-badges">
                              {hasScreen(r) && (
                                <span className="rm-badge">
                                  <Tv size={11} />
                                  Pantalla LED
                                </span>
                              )}
                              {hasLedCube(r) && (
                                <span className="rm-badge">
                                  <Tv size={11} />
                                  Cubo LED
                                </span>
                              )}
                              {allowsSwingExtra(r) && (
                                <span className="rm-badge">
                                  <Armchair size={11} />
                                  Columpio
                                </span>
                              )}
                            </div>
                            <div className="rm-room-desc">{getRoomDescription(r)}</div>
                          </div>
                          <div className="rm-room-cta">
                            <div>
                              {fromPrice !== undefined ? (
                                <>
                                  <div className="rm-price-from">desde</div>
                                  <div className="rm-price-amount rm-serif">{eur(fromPrice)}</div>
                                </>
                              ) : (
                                <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>
                                  Consultar
                                </div>
                              )}
                            </div>
                            <button
                              className="rm-btn-select"
                              onClick={() => !blocked && selectRoom(r)}
                              disabled={!!blocked}
                              style={blocked ? { opacity: 0.35, cursor: "not-allowed" } : {}}
                            >
                              {unavailable
                                ? "No disponible"
                                : overnightBlocked
                                  ? "Solo por horas"
                                  : "Elegir esta"}
                            </button>
                          </div>
                        </div>

                        {/* Extras section inside card */}
                        {roomExtras.length > 0 && (
                          <div className="rm-room-extras">
                            <button
                              className="rm-extras-toggle"
                              onClick={() => setExpandedExtrasRoom(isExpanded ? null : r.id)}
                            >
                              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <Gift size={14} />
                                Añadir extras
                                {selectedInRoom.length > 0 && (
                                  <span
                                    style={{
                                      background: "rgba(115,20,35,0.12)",
                                      color: "var(--blood-dark)",
                                      border: "1px solid rgba(115,20,35,0.25)",
                                      borderRadius: 20,
                                      padding: "1px 8px",
                                      fontSize: 11,
                                      fontWeight: 600,
                                    }}
                                  >
                                    {selectedInRoom.length} seleccionado
                                    {selectedInRoom.length > 1 ? "s" : ""}
                                  </span>
                                )}
                              </span>
                              <span
                                style={{ fontSize: 20, lineHeight: 1, color: "var(--ink-soft)" }}
                              >
                                {isExpanded ? "−" : "+"}
                              </span>
                            </button>

                            {isExpanded && (
                              <>
                                {(["decoration", "hookah", "accessories", "drinks"] as const).map(
                                  (cat) => {
                                    const items = roomExtras.filter(
                                      (e) =>
                                        e.category === cat && swingExtraMatchesMode(e, isOvernight),
                                    );
                                    if (!items.length) return null;
                                    return (
                                      <div key={cat} style={{ marginBottom: 20 }}>
                                        <div
                                          style={{
                                            fontSize: 11,
                                            letterSpacing: "0.1em",
                                            textTransform: "uppercase",
                                            color: "var(--gold)",
                                            fontWeight: 500,
                                            marginBottom: 10,
                                            marginTop: 16,
                                          }}
                                        >
                                          {EXTRA_CATEGORY_LABELS[cat] ?? cat}
                                        </div>
                                        <div className="rm-extras-grid">
                                          {items.map((ex) => {
                                            const q = extraQty[ex.id] ?? 0;
                                            return (
                                              <div
                                                key={ex.id}
                                                className={`rm-extra-item${q > 0 ? " selected" : ""}`}
                                              >
                                                {ex.category === "decoration" && (
                                                  <DecorationCarousel images={DECORATION_PHOTOS} />
                                                )}
                                                <div className="rm-extra-body">
                                                  <div className="rm-extra-name">
                                                    {displayExtraName(ex)}
                                                  </div>
                                                  {ex.description && (
                                                    <div className="rm-extra-desc">
                                                      {ex.description}
                                                    </div>
                                                  )}
                                                  <div className="rm-extra-footer">
                                                    <div className="rm-extra-price rm-serif">
                                                      {eur(Number(ex.price))}
                                                    </div>
                                                    <div className="rm-extra-qty">
                                                      <button
                                                        className="rm-qty-btn"
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          changeQty(ex.id, -1);
                                                        }}
                                                      >
                                                        −
                                                      </button>
                                                      <span className="rm-qty-val">{q}</span>
                                                      <button
                                                        className="rm-qty-btn"
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          changeQty(ex.id, 1);
                                                        }}
                                                      >
                                                        +
                                                      </button>
                                                    </div>
                                                  </div>
                                                  {renderDecoMessageInputs(ex, r)}
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  },
                                )}
                                {extrasTotalSelected > 0 && (
                                  <div
                                    style={{
                                      paddingTop: 12,
                                      borderTop: "1px solid var(--border)",
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                    }}
                                  >
                                    <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>
                                      Extras seleccionados
                                    </span>
                                    <span
                                      style={{
                                        fontFamily: "'Playfair', serif",
                                        fontSize: 20,
                                        color: "var(--gold-dark)",
                                        fontWeight: 500,
                                      }}
                                    >
                                      {eur(extrasTotalSelected)}
                                    </span>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {!date && (
              <div className="rm-trust" style={{ marginTop: 40 }}>
                <div className="rm-trust-item">
                  <div className="rm-trust-icon">
                    <Clock size={20} />
                  </div>
                  <div>
                    <div className="rm-trust-title">Sin registro</div>
                    <div className="rm-trust-sub">Reserva en 2 minutos.</div>
                  </div>
                </div>
                <div className="rm-trust-item">
                  <div className="rm-trust-icon">
                    <CreditCard size={20} />
                  </div>
                  <div>
                    <div className="rm-trust-title">Solo 30% online</div>
                    <div className="rm-trust-sub">El resto al llegar.</div>
                  </div>
                </div>
                <div className="rm-trust-item">
                  <div className="rm-trust-icon">
                    <Flame size={20} />
                  </div>
                  <div>
                    <div className="rm-trust-title">Confirmación al instante</div>
                    <div className="rm-trust-sub">Email en segundos.</div>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── STEP 2: ROOM DETAIL + extras confirm ── */}
        {step === "room-detail" && room && (
          <div className="rm-layout">
            <div>
              {/* Room hero */}
              <div className="rm-card" style={{ padding: 0, overflow: "hidden", marginBottom: 20 }}>
                <RoomImageCarousel images={getRoomImages(room)} alt={room.name} height={260} />
                <div style={{ padding: "24px 28px" }}>
                  <div
                    style={{
                      fontSize: 11,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: "var(--gold)",
                      fontWeight: 500,
                      marginBottom: 6,
                    }}
                  >
                    RM {room.building}
                  </div>
                  <div
                    style={{
                      fontFamily: "'Playfair', serif",
                      fontSize: 30,
                      fontWeight: 500,
                      color: "var(--ink)",
                      marginBottom: 12,
                    }}
                  >
                    {room.name}
                  </div>
                  <div className="rm-room-badges">
                    {hasScreen(room) && (
                      <span className="rm-badge">
                        <Tv size={11} />
                        Pantalla LED
                      </span>
                    )}
                    {hasLedCube(room) && (
                      <span className="rm-badge">
                        <Tv size={11} />
                        Cubo LED
                      </span>
                    )}
                    {allowsSwingExtra(room) && (
                      <span className="rm-badge">
                        <Armchair size={11} />
                        Columpio
                      </span>
                    )}
                  </div>

                  {/* Contact options */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20 }}>
                    {WHATSAPP_NUMBERS[building] && (
                      <a
                        href={`https://wa.me/${WHATSAPP_NUMBERS[building].intl}?text=${encodeURIComponent(`Hola, quiero consultar sobre la habitación ${room.name} (RM ${room.building})`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                          height: 48,
                          borderRadius: 10,
                          background: "#25D366",
                          color: "#fff",
                          fontSize: 13,
                          fontWeight: 600,
                          letterSpacing: "0.06em",
                          textDecoration: "none",
                          textTransform: "uppercase",
                          fontFamily: "'Noto Sans', sans-serif",
                        }}
                      >
                        <MessageCircle size={16} /> Consulta por WhatsApp
                      </a>
                    )}
                    {CONTACTS[building]?.phones[1] && (
                      <a
                        href={CONTACTS[building].phones[1].href}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                          height: 48,
                          borderRadius: 10,
                          border: "1.5px solid var(--border-strong)",
                          background: "var(--warm-white)",
                          color: "var(--ink)",
                          fontSize: 13,
                          fontWeight: 600,
                          letterSpacing: "0.06em",
                          textDecoration: "none",
                          textTransform: "uppercase",
                          fontFamily: "'Noto Sans', sans-serif",
                        }}
                      >
                        <Phone size={16} /> Consulta por teléfono
                      </a>
                    )}
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 12, margin: "2px 0" }}
                    >
                      <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                      <span
                        style={{
                          fontSize: 11,
                          color: "var(--ink-soft)",
                          textTransform: "uppercase",
                          letterSpacing: "0.1em",
                        }}
                      >
                        o reserva online
                      </span>
                      <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Extras confirmation */}
              {extras && extras.length > 0 && (
                <div className="rm-card">
                  <h2 className="rm-serif" style={{ marginBottom: 6 }}>
                    Extras para tu estancia
                  </h2>
                  <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 24 }}>
                    Opcional — puedes continuar sin añadir nada.
                  </p>

                  {(["decoration", "hookah", "accessories", "drinks"] as const).map((cat) => {
                    const items = extras.filter(
                      (e) =>
                        e.category === cat &&
                        extraAvailableForRoom(e, room) &&
                        swingExtraMatchesMode(e, isOvernight),
                    );
                    if (!items.length) return null;
                    return (
                      <div key={cat} style={{ marginBottom: 24 }}>
                        <div
                          style={{
                            fontSize: 11,
                            letterSpacing: "0.1em",
                            textTransform: "uppercase",
                            color: "var(--gold)",
                            fontWeight: 500,
                            marginBottom: 12,
                          }}
                        >
                          {EXTRA_CATEGORY_LABELS[cat]}
                        </div>
                        <div className="rm-extras-grid">
                          {items.map((ex) => {
                            const q = extraQty[ex.id] ?? 0;
                            const isGift = breakdown?.giftedExtraIds.includes(ex.id);
                            return (
                              <div
                                key={ex.id}
                                className={`rm-extra-item${q > 0 ? " selected" : ""}`}
                              >
                                {ex.category === "decoration" && (
                                  <DecorationCarousel images={DECORATION_PHOTOS} />
                                )}
                                <div className="rm-extra-body">
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "flex-start",
                                      justifyContent: "space-between",
                                      gap: 4,
                                      marginBottom: 2,
                                    }}
                                  >
                                    <div className="rm-extra-name">{displayExtraName(ex)}</div>
                                    {isGift && q === 0 && (
                                      <span
                                        style={{
                                          background: "var(--cream-dark)",
                                          border: "1px solid var(--border)",
                                          borderRadius: 6,
                                          padding: "2px 7px",
                                          fontSize: 10,
                                          fontWeight: 500,
                                          color: "var(--gold-dark)",
                                          whiteSpace: "nowrap",
                                        }}
                                      >
                                        <Gift
                                          size={9}
                                          style={{ display: "inline", marginRight: 3 }}
                                        />
                                        Regalo
                                      </span>
                                    )}
                                  </div>
                                  {ex.description && (
                                    <div className="rm-extra-desc">{ex.description}</div>
                                  )}
                                  <div className="rm-extra-footer">
                                    <div className="rm-extra-price rm-serif">
                                      {eur(Number(ex.price))}
                                    </div>
                                    <div className="rm-extra-qty">
                                      <button
                                        className="rm-qty-btn"
                                        onClick={() => changeQty(ex.id, -1)}
                                      >
                                        −
                                      </button>
                                      <span className="rm-qty-val">{q}</span>
                                      <button
                                        className="rm-qty-btn"
                                        onClick={() => changeQty(ex.id, 1)}
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>
                                  {renderDecoMessageInputs(ex)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <button
                className="rm-btn-continue"
                onClick={() => {
                  const err = validateDecoMessages();
                  if (err) return toast.error(err);
                  setStep("details");
                }}
              >
                Continuar con mis datos <ChevronRight size={16} />
              </button>
            </div>
            <SummaryBar
              room={room}
              startAt={startAt}
              endAt={endAt}
              people={people}
              isOvernight={isOvernight}
              duration={pricingDuration}
              breakdown={breakdown}
            />
          </div>
        )}

        {/* ── STEP 3: DETAILS ── */}
        {step === "details" && room && (
          <div className="rm-layout">
            <div className="rm-card">
              <h2 className="rm-serif">Tus datos</h2>
              <div className="rm-form-grid">
                <div className="rm-field">
                  <label className="rm-label">Nombre completo *</label>
                  <Input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    maxLength={100}
                  />
                </div>
                <div className="rm-field">
                  <label className="rm-label">Email *</label>
                  <Input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    maxLength={255}
                  />
                </div>
                <div className="rm-field rm-form-full">
                  <label className="rm-label">Teléfono (opcional)</label>
                  <Input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    maxLength={30}
                  />
                </div>
              </div>

              <Separator style={{ margin: "24px 0" }} />

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <label className="rm-check-row">
                  <Checkbox checked={adult} onCheckedChange={(v) => setAdult(v === true)} />
                  <span>
                    Confirmo que soy <strong>mayor de 18 años</strong>. *
                  </span>
                </label>
                <div className="rm-check-row" style={{ cursor: "default" }}>
                  <Checkbox
                    checked={acceptedTerms}
                    onCheckedChange={(v) => setAcceptedTerms(v === true)}
                  />
                  <span>
                    Acepto las{" "}
                    <button
                      type="button"
                      onClick={() => setTermsOpen(true)}
                      style={{
                        background: "none",
                        border: "none",
                        padding: 0,
                        color: "var(--gold-dark)",
                        fontWeight: 500,
                        textDecoration: "underline",
                        cursor: "pointer",
                        font: "inherit",
                      }}
                    >
                      condiciones de reserva y políticas de cancelación
                    </button>
                    . *
                  </span>
                </div>
                <label className="rm-check-row">
                  <Checkbox checked={noContact} onCheckedChange={(v) => setNoContact(v === true)} />
                  <span>No quiero recibir comunicaciones comerciales.</span>
                </label>
              </div>

              <button className="rm-btn-continue" onClick={submitDetails}>
                Continuar al pago <ChevronRight size={16} />
              </button>
            </div>
            <SummaryBar
              room={room}
              startAt={startAt}
              endAt={endAt}
              people={people}
              isOvernight={isOvernight}
              duration={pricingDuration}
              breakdown={breakdown}
            />

            <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
              <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle>Condiciones de reserva</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                  <ul className="list-disc space-y-2 pl-5">
                    <li>Los jacuzzis se encontrarán vacíos para comprobar que estén limpios.</li>
                    <li>
                      Sólo se gestionan reservas a mayores de 18 años. No aceptamos permiso de
                      tutor/padre/madre. Se solicitará DNI a partir de 21:00 a 09:00 (durante el día
                      se solicitará si es necesario comprobar la edad).
                    </li>
                    <li>Prohibida la entrada de bebidas, cachimbas y decoraciones de fuera.</li>
                    <li>Nos reservamos el derecho de admisión.</li>
                    <li>
                      No se permiten faltas de respeto hacia otros clientes ni hacia el personal.
                    </li>
                    <li>
                      El personal llamará por teléfono a la habitación cinco minutos antes de la
                      hora de salida en reservas por horas y treinta minutos antes en reservas por
                      noche completa.
                    </li>
                  </ul>

                  <div>
                    <p className="font-semibold text-foreground">En caso de retraso:</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5">
                      <li>Pasados 5 minutos, se cobrará una penalización de 10€.</li>
                      <li>
                        Cada 5 minutos adicionales, se cobrará otro recargo de 10€, sucesivamente,
                        hasta realizar la salida.
                      </li>
                    </ul>
                  </div>

                  <p>
                    Las reservas serán anuladas pasados 15 minutos desde la hora de entrada si el
                    cliente no avisa. En caso de llegar con retraso, la hora de salida no varía y se
                    cobrará el tiempo reservado.
                  </p>

                  <div>
                    <p className="font-semibold text-foreground">Opciones de cancelación:</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5">
                      <li>Cambio de fecha, según disponibilidad.</li>
                      <li>
                        Si cancela dentro de las 48h previas a la reserva, pierde la reserva y el
                        pago anticipado.
                      </li>
                      <li>En ningún caso se devuelve el importe abonado.</li>
                    </ul>
                  </div>

                  <p>Por daños ocasionados en las instalaciones, deberá cubrir dichos gastos.</p>

                  <div>
                    <p className="font-semibold text-foreground">Grupos de 3 personas:</p>
                    <p className="mt-1">
                      Será necesario dejar una fianza entre 50€ y 100€ en efectivo según valoración
                      del establecimiento.
                    </p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {/* ── STEP 4: PAYMENT ── */}
        {step === "payment" && room && breakdown && (
          <div className="rm-layout">
            <div className="rm-card">
              <h2 className="rm-serif">Pago del depósito</h2>
              <p
                style={{
                  fontSize: 14,
                  color: "var(--ink-soft)",
                  marginBottom: 24,
                  lineHeight: 1.65,
                }}
              >
                Para confirmar tu reserva solo necesitas pagar el <strong>30%</strong> ahora. El
                resto lo pagas en el hotel al llegar.
              </p>

              <div className="rm-payment-box">
                <div className="rm-payment-row">
                  <span>Total reserva</span>
                  <span className="rm-payment-row-val">{eur(payableTotal)}</span>
                </div>
                {promo && discountAmount > 0 && (
                  <div className="rm-payment-row">
                    <span>
                      Descuento {promo.code}
                      {!promo.debug && " (habitación)"}
                    </span>
                    <span className="rm-payment-row-val" style={{ color: "var(--gold-dark)" }}>
                      −{eur(discountAmount)} (antes {eur(breakdown.total)})
                    </span>
                  </div>
                )}
                <div className="rm-payment-row">
                  <span>A pagar en el hotel</span>
                  <span className="rm-payment-row-val">
                    {eur(Math.max(0, payableTotal - depositAmount))}
                  </span>
                </div>
                <div className="rm-payment-highlight">
                  <span style={{ fontSize: 14 }}>Depósito ahora (30%)</span>
                  <span className="rm-payment-amount rm-serif">{eur(depositAmount)}</span>
                </div>
              </div>

              {/* Discount code */}
              <div style={{ display: "flex", gap: 8, marginBottom: 20, alignItems: "flex-end" }}>
                <div className="rm-field" style={{ flex: 1 }}>
                  <label className="rm-label">Código de descuento</label>
                  <Input
                    value={discountInput}
                    onChange={(e) => setDiscountInput(e.target.value)}
                    placeholder="Introduce tu código"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        applyDiscount();
                      }
                    }}
                  />
                </div>
                <Button type="button" variant="outline" onClick={applyDiscount}>
                  Aplicar
                </Button>
              </div>

              <button
                className="rm-btn-primary"
                style={{ display: "flex" }}
                onClick={createReservation}
                disabled={paying}
              >
                {paying ? "Redirigiendo al TPV…" : `Pagar ${eur(depositAmount)} con tarjeta`}
              </button>

              <p
                style={{
                  fontSize: 11,
                  color: "var(--ink-soft)",
                  textAlign: "center",
                  marginTop: 10,
                }}
              >
                Pago seguro procesado por Redsys · Redirección al TPV de tu banco
              </p>

              {/* Alternative: book via WhatsApp (no card payment, no Redsys).
                  Hidden for bookings over 3h (and overnight) — those must go
                  through the card flow on the public web. */}
              {!isOvernight && pricingDuration <= 180 && (
                <>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      margin: "22px 0 16px",
                    }}
                  >
                    <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                    <span
                      style={{
                        fontSize: 11,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: "var(--ink-soft)",
                      }}
                    >
                      o
                    </span>
                    <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                  </div>

                  <button
                    type="button"
                    onClick={reserveViaWhatsApp}
                    disabled={paying}
                    style={{
                      width: "100%",
                      height: 52,
                      borderRadius: 10,
                      border: "none",
                      background: "#25D366",
                      color: "#fff",
                      cursor: paying ? "not-allowed" : "pointer",
                      fontSize: 14,
                      fontWeight: 500,
                      letterSpacing: "0.04em",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      fontFamily: "'Noto Sans', sans-serif",
                      opacity: paying ? 0.5 : 1,
                      transition: "filter 0.2s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(0.93)")}
                    onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
                  >
                    <MessageCircle size={18} /> Reservar por WhatsApp (sin pago online)
                  </button>

                  <p
                    style={{
                      fontSize: 11,
                      color: "var(--ink-soft)",
                      textAlign: "center",
                      marginTop: 10,
                    }}
                  >
                    Te abriremos un chat con los datos de tu reserva. Sin pago con tarjeta ·
                    Confirmación con recepción
                  </p>
                </>
              )}
            </div>
            <SummaryBar
              room={room}
              startAt={startAt}
              endAt={endAt}
              people={people}
              isOvernight={isOvernight}
              duration={pricingDuration}
              breakdown={breakdown}
            />
          </div>
        )}

        {/* ── STEP 5: DONE ── */}
        {step === "done" && (
          <div className="rm-done">
            <div className="rm-done-icon">
              <CheckCircle2 size={32} />
            </div>
            <h2 className="rm-serif">
              ¡Reserva
              <br />
              confirmada!
            </h2>
            <p>
              Te hemos enviado un email de confirmación a <strong>{customerEmail}</strong> con todos
              los detalles. Si no lo encuentras, revisa la carpeta de spam.
            </p>
            <p className="rm-done-ref">Referencia: {reservationId?.slice(0, 8)?.toUpperCase()}</p>
            <div style={{ marginTop: 32 }}>
              <button
                className="rm-btn-primary"
                style={{ maxWidth: 280, margin: "0 auto" }}
                onClick={() => {
                  setStep("search");
                  setRoom(null);
                  setExtraQty({});
                  setDecoMessages({});
                  setDiscountInput("");
                  setPromo(null);
                  setReservationId(null);
                  setAdult(false);
                  setCustomerName("");
                  setCustomerEmail("");
                  setCustomerPhone("");
                }}
              >
                Hacer otra reserva
              </button>
            </div>
          </div>
        )}
      </main>

      <SiteFooter />

      <CookieConsent />
    </div>
  );
}

// ─────────────────────────────────────────────
// Summary sidebar
// ─────────────────────────────────────────────
function SummaryBar({
  room,
  startAt,
  endAt,
  people,
  isOvernight,
  duration,
  breakdown,
}: {
  room: RoomLite;
  startAt: Date | null;
  endAt: Date | null;
  people: number;
  isOvernight: boolean;
  duration: number;
  breakdown: PriceBreakdown | null;
}) {
  return (
    <div className="rm-summary">
      <img src={getRoomImage(room)} alt="" className="rm-summary-room-img" />
      <div className="rm-summary-label">Tu habitación</div>
      <div className="rm-summary-name rm-serif">
        {room.name} · RM {room.building}
      </div>

      <hr className="rm-summary-divider" />

      <div className="rm-summary-row">
        <span>Entrada</span>
        <span className="rm-summary-row-val">
          {startAt?.toLocaleString("es-ES", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
      <div className="rm-summary-row">
        <span>Salida</span>
        <span className="rm-summary-row-val">
          {endAt?.toLocaleString("es-ES", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
      <div className="rm-summary-row">
        <span>Duración</span>
        <span className="rm-summary-row-val">
          {isOvernight ? "Noche completa" : DURATION_LABELS[duration]}
        </span>
      </div>
      <div className="rm-summary-row">
        <span>Personas</span>
        <span className="rm-summary-row-val">{people}</span>
      </div>

      {breakdown && (
        <>
          <hr className="rm-summary-divider" />
          <div className="rm-summary-row">
            <span>Habitación</span>
            <span className="rm-summary-row-val">{eur(breakdown.base)}</span>
          </div>
          {breakdown.thirdPerson > 0 && (
            <div className="rm-summary-row">
              <span>Supl. personas</span>
              <span className="rm-summary-row-val">{eur(breakdown.thirdPerson)}</span>
            </div>
          )}
          {breakdown.dynamicSurcharge > 0 && (
            <div className="rm-summary-row">
              <span>Recargo</span>
              <span className="rm-summary-row-val" style={{ color: "var(--gold-light)" }}>
                {eur(breakdown.dynamicSurcharge)}
              </span>
            </div>
          )}
          {breakdown.extrasTotal > 0 && (
            <div className="rm-summary-row">
              <span>Extras</span>
              <span className="rm-summary-row-val">{eur(breakdown.extrasTotal)}</span>
            </div>
          )}
          <hr className="rm-summary-divider" />
          <div className="rm-summary-total">
            <span>Total</span>
            <span className="rm-summary-total-val rm-serif">{eur(breakdown.total)}</span>
          </div>
          <div className="rm-summary-deposit">
            Depósito 30% online:{" "}
            <strong style={{ color: "var(--gold-light)" }}>{eur(breakdown.total * 0.3)}</strong>
          </div>
        </>
      )}
    </div>
  );
}
