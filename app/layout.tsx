import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AskAyurved",
  description: "Classical Ayurvedic knowledge, cited and contextualized.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen p-8 md:p-16 max-w-4xl mx-auto">
        {children}
      </body>
    </html>
  );
}
