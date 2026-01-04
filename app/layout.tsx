import type { Metadata } from "next";
import {  Inter } from "next/font/google";

import "./globals.css";
import ClientProviders from "@/providers/client-providers";

const inter = Inter({ subsets: ["latin"]});

export const metadata: Metadata = {
  title: "Bitlabs WhatsApp CRM",
  description: "Bitlabs WhatsApp CRM",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className} suppressHydrationWarning={true}>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
