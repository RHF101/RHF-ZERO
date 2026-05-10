import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SuperAI",
  description: "AI Canggih dengan Multi-Model Pipeline",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
