import type { Metadata } from "next";
import { IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import "./workspace.css";
import "./ui.css";
import "./warmth.css";
import { AuthProvider } from "@/context/AuthContext";
import { I18nProvider } from "@/i18n/I18nProvider";
import { ToastProvider } from "@/components/ui/Toast";
import LanguageSync from "@/components/LanguageSync";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-source",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jetbrains-source",
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
    <html lang="en" className={`${plexSans.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <head>
        {/* Apply the saved theme before first paint so dark mode does not flash light. */}
        <script dangerouslySetInnerHTML={{ __html: "try{if(localStorage.getItem('hfl_theme')==='dark')document.documentElement.setAttribute('data-theme','dark')}catch(e){}" }} />
      </head>
      <body className="font-body">
        <I18nProvider>
          <ToastProvider>
            <AuthProvider>
              <LanguageSync />
              {children}
            </AuthProvider>
          </ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
