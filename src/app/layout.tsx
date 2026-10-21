import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "BestelBon", template: "%s · BestelBon" },
  description: "Online bestellen met automatische keuken- en bezorgbonnen.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#0b1033" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl-BE">
      <body>{children}</body>
    </html>
  );
}
