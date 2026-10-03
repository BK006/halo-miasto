import { ImageResponse } from "next/og";

// Placeholder PWA icon generated as PNG; replace once the design system lands.
export async function GET(_req: Request, ctx: RouteContext<"/pwa-icon/[size]">) {
  const { size } = await ctx.params;
  const px = size === "192" ? 192 : 512;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#111111",
          color: "#ffffff",
          fontSize: px * 0.42,
          fontWeight: 700,
        }}
      >
        Z!
      </div>
    ),
    { width: px, height: px },
  );
}
