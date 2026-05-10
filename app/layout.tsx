// app/layout.tsx
import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'AI Super Web Gw',
  description: 'AI Coding Super Intelligence - Multi Agent • Multi Model • Vision',
  icons: {
    icon: '/favicon.ico',
  },
  openGraph: {
    title: 'AI Super Web Gw',
    description: 'AI paling canggih untuk coding dan percakapan',
    images: [{ url: '/og-image.jpg' }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className="dark">
      <body
        className={`${inter.variable} ${jetbrains.variable} antialiased bg-zinc-950 text-zinc-100`}
      >
        {children}
      </body>
    </html>
  );
}
