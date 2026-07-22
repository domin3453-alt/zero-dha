import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Zerodha — Paper Trading App",
    template: "%s · Zerodha",
  },
  description:
    "Zerodha is a paper trading (simulated) app for indices, equities & commodities. Practise the markets risk-free — no real money is invested.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
