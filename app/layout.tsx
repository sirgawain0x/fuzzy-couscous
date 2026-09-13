import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "@/app/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const conthrax = localFont({
  src: "../public/fonts/ConthraxSb-Regular.otf",
  variable: "--font-conthrax",
  display: "swap",
});

const SOCIAL_IMAGE_URL =
  "https://bank.creativeplatform.xyz/icons/v2/white_bg/white_creative_icon_192x192.png";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.NODE_ENV === "production"
        ? "https://creativeplatform.xyz"
        : "http://localhost:3000")
  ),
  title: "Creative Finance",
  description:
    "Banking designed for creatives. Manage your income, track expenses, and save for your dreams.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Creative Finance",
  },
  icons: {
    icon: [
      {
        url: "/icons/v2/white_bg/white_creative_icon_192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/icons/v2/white_bg/white_creative_products-152x152.png",
        sizes: "152x152",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/icons/v2/white_bg/white_creative_icons-180x180.png",
        sizes: "180x180",
        type: "image/png",
      },
      {
        url: "/icons/v2/white_bg/white_creative_products-152x152.png",
        sizes: "152x152",
        type: "image/png",
      },
    ],
  },
  openGraph: {
    type: "website",
    url: "https://bank.creativeplatform.xyz",
    siteName: "Creative Finance",
    title: "Creative Finance",
    description:
      "Banking designed for creatives. Manage your income, track expenses, and save for your dreams.",
    images: [
      {
        url: SOCIAL_IMAGE_URL,
        width: 192,
        height: 192,
        alt: "Creative Finance",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Creative Finance",
    description:
      "Banking designed for creatives. Manage your income, track expenses, and save for your dreams.",
    images: [SOCIAL_IMAGE_URL],
  },
  other: {
    "base:app_id": process.env.NEXT_PUBLIC_BASE_APP_ID || "",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${conthrax.variable} relative box-content overflow-x-hidden antialiased`}
      >
        {/* Video Background */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="fixed top-0 left-0 -z-20 h-full w-full object-cover"
          src="/video/background.mp4"
        />
        {/* Overlay for readability */}
        <div className="pointer-events-none fixed top-0 left-0 -z-10 h-full w-full bg-black/40" />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
