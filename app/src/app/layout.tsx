import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DeedSlice Console",
  description: "Tokenize real estate on Hedera. Investor dashboards, NFT deeds, fractional ownership.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-ds-bg text-ds-text antialiased">
        {children}
      </body>
    </html>
  );
}
