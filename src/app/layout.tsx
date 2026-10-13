import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "@/lib/blockchain/wallet";
import { NetworkBanner } from "@/components/web3/NetworkBanner";
import { TxLifecycleBanner } from "@/components/web3/TxLifecycleBanner";

export const metadata: Metadata = {
  title: "AttendChain — Verifiable Blockchain Attendance Management",
  description:
    "Privacy-preserving, tamper-evident classroom attendance management on Ethereum Sepolia and Hardhat.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-indigo-100 selection:text-indigo-900">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-indigo-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg"
        >
          Skip to main content
        </a>
        <WalletProvider>
          <NetworkBanner />
          {children}
          <TxLifecycleBanner />
        </WalletProvider>
      </body>
    </html>
  );
}
