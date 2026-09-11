import type { Metadata } from "next";
import { Inter, Space_Grotesk, Geist_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Overnight Brief: Your AI Research Desk for Tokenized Markets",
  description:
    "Wake up to a multi-agent briefing on what happened in tokenized US-stock markets while you slept. Five specialist analysts, one ranked briefing, clear action items.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${geistMono.variable} antialiased`}
      style={{ colorScheme: "dark" }}
    >
      <body className="flex flex-col">{children}</body>
    </html>
  );
}
