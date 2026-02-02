import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import AuthProvider from "@/lib/session-provider";
import { Navbar } from "@/components/navbar";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Take Me Out to the Ballparks",
  description: "Plan your MLB ballpark-visit itinerary for the 2026 season",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    title: "Take Me Out to the Ballparks",
    description: "Plan your ultimate MLB ballpark road trip for the 2026 season",
    images: ["/logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <ThemeProvider>
            <div className="flex min-h-screen flex-col">
              <Navbar />
              <main className="container mx-auto flex-1 px-4 py-6">{children}</main>
                <footer className="border-t bg-muted/40 py-6 text-xs text-muted-foreground">
                <div className="container mx-auto flex flex-wrap items-center justify-between gap-4 px-4">
                  <div className="flex items-center gap-2">
                    <img src="/logo.png" alt="" width={24} height={24} className="rounded-full opacity-70" />
                    <span>Take Me Out to the Ballparks &middot; v0.1.0</span>
                  </div>
                  <div className="flex gap-4">
                    <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
                    <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
                    <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
                  </div>
                  <span>&copy; {new Date().getFullYear()} All rights reserved</span>
                </div>
              </footer>
            </div>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
