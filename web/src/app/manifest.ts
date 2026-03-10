import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TerraPOS",
    short_name: "TerraPOS",
    description: "POS modern nuansa alam",
    start_url: "/pos",
    display: "standalone",
    background_color: "#07120f",
    theme_color: "#07120f",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
