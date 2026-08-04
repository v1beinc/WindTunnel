import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WindTunnel — aerodynamic lab",
  description:
    "An interactive reduced-order wind tunnel for learning, designing and comparing aerodynamic objects.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
