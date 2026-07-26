import type { Metadata } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "La Grande Enciclopedia",
  description:
    "Un compendio di lore e meccanica sul mondo conosciuto e non.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it">
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
