import type { NextConfig } from "next";

// Every page in this app is private and per-user, so pages render dynamically
// on each request. Cache Components is intentionally left off.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
