import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import AnalyticsInit from "@/components/AnalyticsInit";
import UpdateChecker from "@/components/UpdateChecker";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Override",
  description:
    "Override is the financial operating platform for Broadway producers—from modeling your capitalization to managing investors, tracking recoupment, and distributing returns.",
  keywords: ["Broadway", "investment", "theatre", "recoupment", "waterfall", "producer"],
  openGraph: {
    title: "Override",
    description: "The financial operating platform for Broadway producers—deal modeling, investor management, and private deal rooms.",
    url: "https://overridebroadway.com",
    siteName: "Override",
    images: [
      {
        url: "https://overridebroadway.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "Override—Broadway Deal Modeling & Investor Management",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Override",
    description: "The financial operating platform for Broadway producers—deal modeling, investor management, and private deal rooms.",
    images: ["https://overridebroadway.com/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AuthProvider>
          <TooltipProvider>
            {children}
            <Toaster richColors position="top-right" />
            <AnalyticsInit />
            <UpdateChecker />
          </TooltipProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
