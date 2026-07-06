import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

export const metadata: Metadata = {
  title: "Human Firewall — Centralized Security Dashboard",
  description: "Unified security awareness platform combining phishing simulation, threat intelligence, and gamified employee training. Powered by Human Firewall.",
  keywords: "cybersecurity, phishing, security awareness, human firewall, threat intelligence",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
