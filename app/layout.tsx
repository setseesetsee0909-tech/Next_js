import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Content Collaboration Platform",
  description:
    "Optimistic UX, server-first publishing, SSR plus cache hybrid feed, and realtime feel demo built in Next.js.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
