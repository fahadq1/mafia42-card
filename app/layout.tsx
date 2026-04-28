import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "لعبه بطاقات مافيا42",
  description: "لعبة بطاقات حرب عربية مستوحاة من أدوار المافيا بأسلوب مبارزات تكتيكية.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
