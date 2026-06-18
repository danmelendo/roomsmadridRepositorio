// Shareable per-room URLs for the public booking flow.
//
// Each room of each building gets a stable slug used as `/reservar-<slug>`
// (e.g. /reservar-greyventas) so the link can be shared on OTAs / search
// engines and land the visitor directly on that room.
//
// `building` is the lowercase building key used by the booking page
// (matches the `building` state and HOTELS keys in src/lib/data.ts).
// `name` must match the room `name` stored in the DB (used to locate the room).

export interface RoomSlugEntry {
  slug: string;
  building: "bernabeu" | "ventas" | "america";
  buildingLabel: string;
  name: string;
}

export const ROOM_SLUGS: RoomSlugEntry[] = [
  // RM Ventas
  { slug: "greyventas", building: "ventas", buildingLabel: "RM Ventas", name: "Grey" },
  { slug: "hollywoodventas", building: "ventas", buildingLabel: "RM Ventas", name: "Hollywood" },
  { slug: "musicventas", building: "ventas", buildingLabel: "RM Ventas", name: "Music" },
  { slug: "route66ventas", building: "ventas", buildingLabel: "RM Ventas", name: "Route 66" },
  { slug: "empirestateventas", building: "ventas", buildingLabel: "RM Ventas", name: "Empire State" },

  // RM Bernabéu
  { slug: "greybernabeu", building: "bernabeu", buildingLabel: "RM Bernabéu", name: "Grey" },
  { slug: "oceanbernabeu", building: "bernabeu", buildingLabel: "RM Bernabéu", name: "Ocean" },
  { slug: "parisbernabeu", building: "bernabeu", buildingLabel: "RM Bernabéu", name: "Paris" },
  { slug: "safaribernabeu", building: "bernabeu", buildingLabel: "RM Bernabéu", name: "Safari" },
  { slug: "tokyobernabeu", building: "bernabeu", buildingLabel: "RM Bernabéu", name: "Tokyo" },

  // RM América
  { slug: "greyamerica", building: "america", buildingLabel: "RM América", name: "Grey" },
  { slug: "dubaiamerica", building: "america", buildingLabel: "RM América", name: "Dubai" },
  { slug: "maldivasamerica", building: "america", buildingLabel: "RM América", name: "Maldivas" },
  { slug: "newyorkamerica", building: "america", buildingLabel: "RM América", name: "New York" },
  { slug: "tuyyoamerica", building: "america", buildingLabel: "RM América", name: "Tu y yo" },
];

const BY_SLUG = new Map(ROOM_SLUGS.map((e) => [e.slug.toLowerCase(), e]));

export function roomForSlug(slug: string | undefined | null): RoomSlugEntry | null {
  if (!slug) return null;
  return BY_SLUG.get(slug.toLowerCase()) ?? null;
}

export function slugForRoom(building: string, name: string): string | null {
  const b = building.trim().toLowerCase();
  const n = name.trim().toLowerCase();
  const match = ROOM_SLUGS.find(
    (e) => b.includes(e.building) && e.name.toLowerCase() === n,
  );
  return match?.slug ?? null;
}
