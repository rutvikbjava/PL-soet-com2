import React from "react";
import "./globals.css";

export const metadata = {
  title: "Next.js App",
  description: "Next.js 14 App Router project",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
