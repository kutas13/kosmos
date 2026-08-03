import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FoxVize — Müşteri Yönetimi",
  description: "Iç kullanım paneli",
  // Google/Bing/Yandex vb. indekslemesin. Bu, robots.txt ile birlikte
  // ekstra bir savunma katmani (ozellikle mevcut cache'i temizlemek icin).
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      "max-snippet": 0,
      "max-image-preview": "none",
      "max-video-preview": 0,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
