import { createFileRoute } from "@tanstack/react-router";
import { PublicReservePage } from "./reservar";
import { roomForSlug } from "@/lib/roomSlugs";

// Shareable per-room booking URLs, e.g. /reservar-greyventas.
// Single dynamic route with a prefixed path param: `reservar-{$slug}`.
export const Route = createFileRoute("/reservar-{$slug}")({
  component: RoomReservePage,
  head: ({ params }) => {
    const entry = roomForSlug((params as { slug?: string }).slug);
    if (!entry) {
      return {
        meta: [
          { title: "Reserva · Rooms Madrid" },
          {
            name: "description",
            content:
              "Habitaciones temáticas con jacuzzi en el centro de Madrid. Reserva online en 2 minutos. Solo +18.",
          },
        ],
      };
    }
    const title = `${entry.name} · ${entry.buildingLabel} · Rooms Madrid`;
    const description = `Reserva la habitación ${entry.name} de ${entry.buildingLabel}: habitación temática por horas o noche completa en el centro de Madrid. Reserva online en 2 minutos. Solo +18.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "product" },
      ],
    };
  },
});

function RoomReservePage() {
  const { slug } = Route.useParams();
  return <PublicReservePage initialSlug={slug} />;
}
