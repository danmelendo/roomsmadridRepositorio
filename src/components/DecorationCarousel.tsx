import { useEffect, useState } from "react";

/**
 * Auto-advancing photo carousel for the decoration extras (real uploaded
 * photos, no AI placeholders). Each card mounts its own instance.
 */
export function DecorationCarousel({
  images,
  intervalMs = 3500,
  height = 90,
}: {
  images: string[];
  intervalMs?: number;
  height?: number;
}) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const t = setInterval(() => setI((p) => (p + 1) % images.length), intervalMs);
    return () => clearInterval(t);
  }, [images.length, intervalMs]);

  if (!images.length) return null;

  return (
    <div style={{ position: "relative", width: "100%", height, overflow: "hidden", background: "#000" }}>
      {images.map((src, idx) => (
        <img
          key={src}
          src={src}
          alt="Decoración"
          loading="lazy"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
            opacity: idx === i ? 1 : 0,
            transition: "opacity 0.9s ease",
          }}
        />
      ))}
      {images.length > 1 && (
        <div style={{ position: "absolute", bottom: 6, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 4 }}>
          {images.map((_, idx) => (
            <span
              key={idx}
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: idx === i ? "#fff" : "rgba(255,255,255,0.55)",
                transition: "background 0.3s",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
