import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { GameProvider } from "@/lib/game/game-context";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jb-mono",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#0a0e1a",
};

export const metadata: Metadata = {
  title: "Tambola | Play Online Housie with Friends",
  description:
    "Play Tambola (Housie / Indian Bingo) online with friends and family. Create a room, share the code, and enjoy the classic number game — free, no download required.",
  keywords: ["tambola", "housie", "bingo", "online game", "multiplayer"],
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Tambola",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>
        <GameProvider>{children}</GameProvider>
      </body>
    </html>
  );
}
