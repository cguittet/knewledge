import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Knewledge — Keep what matters",
  description: "A private library for the ideas you want to remember.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
