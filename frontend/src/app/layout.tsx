import type { Metadata } from "next";
import { AuthGate } from "@/components/AuthGate";
import { AppSidebar } from "@/components/AppSidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Epilyse | Repository Intelligence",
  description: "Minimal desktop repository intelligence and code graph exploration platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-bg text-ink min-h-screen antialiased flex overflow-hidden selection:bg-accent/30 selection:text-ink">
        <AuthGate>
          <AppSidebar />
          <main className="flex-1 min-w-0 h-screen overflow-y-auto bg-bg flex flex-col">
            {children}
          </main>
        </AuthGate>
      </body>
    </html>
  );
}
