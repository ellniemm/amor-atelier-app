import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["500", "600", "700"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "AMOR ATELIEER — Keuangan",
  description: "Pencatatan keuangan & pesanan AMOR ATELIEER",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#5B2333",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body className={`${fraunces.variable} ${inter.variable} font-sans bg-paper text-ink`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
