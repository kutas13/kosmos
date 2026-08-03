import type { MetadataRoute } from "next";

// Tum arama motorlarina TUM icerigi disallow et.
// Middleware zaten sayfa erisimini engelliyor, bu bir ek koruma katmani.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        disallow: "/",
      },
    ],
    // sitemap YOK; icerik indekslenmesin.
  };
}
