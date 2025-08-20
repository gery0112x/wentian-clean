// app/layout.tsx
import React from "react";

export const metadata = { title: "wentian-clean" }; //（可留可改）

export default function RootLayout({
  children,
}: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
