import { useState } from "react";

/**
 * Manual photo carousel for room images (NO autoscroll). The user advances with
 * the side arrows or the dots. Falls back to a single static image when only one
 * photo is provided.
 */
export function RoomImageCarousel({
  images,
  alt,
  height = 260,
  className,
  style,
}: {
  images: string[];
  alt: string;
  height?: number | string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [i, setI] = useState(0);

  if (!images.length) return null;

  const go = (dir: number) => (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setI((p) => (p + dir + images.length) % images.length);
  };

  // Single image: keep the previous plain <img> behaviour.
  if (images.length === 1) {
    return (
      <img
        src={images[0]}
        alt={alt}
        className={className}
        style={style ?? { width: "100%", height, objectFit: "cover", display: "block" }}
        loading="lazy"
      />
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", height, overflow: "hidden", background: "#000" }}>
      {images.map((src, idx) => (
        <img
          key={src}
          src={src}
          alt={alt}
          loading="lazy"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
            opacity: idx === i ? 1 : 0,
            transition: "opacity 0.5s ease",
          }}
        />
      ))}

      <button
        type="button"
        aria-label="Foto anterior"
        onClick={go(-1)}
        style={arrowStyle("left")}
      >
        ‹
      </button>
      <button
        type="button"
        aria-label="Foto siguiente"
        onClick={go(1)}
        style={arrowStyle("right")}
      >
        ›
      </button>

      <div
        style={{
          position: "absolute",
          bottom: 8,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          gap: 6,
          zIndex: 2,
        }}
      >
        {images.map((_, idx) => (
          <span
            key={idx}
            onClick={(e) => {
              e.stopPropagation();
              setI(idx);
            }}
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              cursor: "pointer",
              background: idx === i ? "#fff" : "rgba(255,255,255,0.5)",
              transition: "background 0.3s",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function arrowStyle(side: "left" | "right"): React.CSSProperties {
  return {
    position: "absolute",
    top: "50%",
    [side]: 8,
    transform: "translateY(-50%)",
    zIndex: 2,
    width: 32,
    height: 32,
    borderRadius: "50%",
    border: "none",
    background: "rgba(0,0,0,0.4)",
    color: "#fff",
    fontSize: 20,
    lineHeight: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    padding: 0,
  };
}
