import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Threadline",
    short_name: "Threadline",
    description: "Plan clients, projects, vendors and designers on one timeline.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbf4f1",
    theme_color: "#fbf4f1",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
