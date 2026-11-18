import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE.name,
    short_name: "اخبار ایرلند",
    description: SITE.description,
    start_url: "/",
    display: "standalone",
    dir: "rtl",
    lang: "fa",
    background_color: "#f6f5f1",
    theme_color: "#0f7a4d",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/logo-1024.png", sizes: "1024x1024", type: "image/png", purpose: "any" },
    ],
  };
}
