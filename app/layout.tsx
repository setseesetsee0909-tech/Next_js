import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Indra Cyber School Tournament",
  description: "Server-first tournament registration system with optimistic UX and SSR dashboard.",
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
