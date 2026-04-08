import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FoxVize — Müşteri Yönetimi",
  description: "Müşteri kaydı ve Chrome eklentisi için API",
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
