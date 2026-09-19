import type { Metadata } from "next";
import "./globals.css";
import "./ui.css";
import "./style.css";

export const metadata: Metadata = {
  title: "JustLDRthings ♡ — Little things, big feelings.",
  description: "Create, collect, and share little moments of love that bridge the distance."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
