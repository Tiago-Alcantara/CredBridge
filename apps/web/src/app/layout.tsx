import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/providers/QueryProvider";
import { ToastProvider } from "@/providers/ToastProvider";
import { PrivyAuthProvider } from "@/providers/PrivyAuthProvider";
import { ThemeToggle } from "@/components/primitives/ThemeToggle";

const inter = Inter({
  subsets: ["latin"],
  variable: "--body",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CredBridge",
  description: "Receivables anticipation platform with on-chain settlement via Stellar",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <ToastProvider>
          <QueryProvider>
            <PrivyAuthProvider>{children}</PrivyAuthProvider>
          </QueryProvider>
        </ToastProvider>
        <ThemeToggle />
      </body>
    </html>
  );
}
