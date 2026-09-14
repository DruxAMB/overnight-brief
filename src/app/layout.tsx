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
  metadataBase: new URL("https://overnight-brief.druxamb.dev"),
  title: "Overnight Brief: Your AI Research Desk for Tokenized Markets",
  description:
    "Wake up to a multi-agent briefing on what happened in tokenized US-stock markets while you slept. Five specialist analysts, one ranked briefing, clear action items.",
  openGraph: {
    title: "Overnight Brief: Your AI Research Desk for Tokenized Markets",
    description:
      "Wake up to a multi-agent briefing on what happened in tokenized US-stock markets while you slept. Five specialist analysts, one ranked briefing, clear action items.",
    url: "https://overnight-brief.druxamb.dev",
    siteName: "Overnight Brief",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Overnight Brief workbench" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Overnight Brief: Your AI Research Desk for Tokenized Markets",
    description:
      "Five specialist analysts, one ranked briefing, clear action items for tokenized US stocks that trade while you sleep.",
    images: ["/og.png"],
  },
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
