import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CodeRAG | Repository intelligence",
  description: "Understand repository structure and dependencies.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
