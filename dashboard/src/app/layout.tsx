import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono-data",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Afferent: Centralized Security Dashboard",
  description: "Unified security awareness platform combining phishing simulation, threat intelligence, and behavioral risk telemetry.",
  keywords: "cybersecurity, phishing, security awareness, afferent, threat intelligence",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-body">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
