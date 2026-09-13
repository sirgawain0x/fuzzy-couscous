import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Creative Bank",
    short_name: "Creative Bank",
    description:
      "Banking designed for creatives. Manage your income, track expenses, and save for your dreams.",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icons/v2/white_bg/white_creative_icon_192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/v2/white_bg/white_creative_icons-180x180.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/v2/white_bg/white_creative_products-152x152.png",
        sizes: "152x152",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
