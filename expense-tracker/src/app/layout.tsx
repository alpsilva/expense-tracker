import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Expense Tracker",
  description: "Controle de despesas recorrentes e empréstimos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="min-h-screen bg-background">
          <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container mx-auto px-4">
              <div className="flex h-14 items-center justify-between">
                <Link href="/" className="font-bold text-lg">
                  Expense Tracker
                </Link>
                <div className="flex items-center gap-6">
                  <Link href="/expenses" className="text-sm font-medium hover:text-primary transition-colors">
                    Despesas
                  </Link>
                  <Link href="/loans" className="text-sm font-medium hover:text-primary transition-colors">
                    Empréstimos
                  </Link>
                  <Link href="/people" className="text-sm font-medium hover:text-primary transition-colors">
                    Pessoas
                  </Link>
                </div>
              </div>
            </div>
          </nav>
          <main className="container mx-auto px-4 py-6">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
