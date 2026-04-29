import { ImageResponse } from "next/og";

export const alt = "LevelRise — Clarity for your climb";
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default async function Image() {
  // Fetch Plus Jakarta Sans from Google Fonts
  const fontData = await fetch(
    "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600&display=swap",
  )
    .then((res) => res.text())
    .then((css) => {
      const match = css.match(/src: url\((.+?)\)/);
      return match ? fetch(match[1]).then((res) => res.arrayBuffer()) : null;
    });

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0B0F17",
        fontFamily: "Plus Jakarta Sans, sans-serif",
      }}
    >
      {/* Brand name */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          marginBottom: "20px",
        }}
      >
        <span
          style={{
            fontSize: 72,
            fontWeight: 600,
            color: "#FFFFFF",
            letterSpacing: "-1px",
          }}
        >
          level
        </span>
        <span
          style={{
            fontSize: 72,
            fontWeight: 600,
            color: "#F2C94C",
            letterSpacing: "-1px",
          }}
        >
          rise
        </span>
      </div>
      {/* Tagline */}
      <div
        style={{
          fontSize: 28,
          color: "#E5E7EB",
          opacity: 0.7,
          letterSpacing: "2px",
          textTransform: "uppercase" as const,
        }}
      >
        Clarity for your climb.
      </div>
    </div>,
    {
      ...size,
      ...(fontData
        ? {
            fonts: [
              {
                name: "Plus Jakarta Sans",
                data: fontData,
                style: "normal" as const,
                weight: 600 as const,
              },
            ],
          }
        : {}),
    },
  );
}
