import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trial Coordinator — Studies & Next Actions",
  description:
    "A personal workspace for saving public clinical studies, tracking follow-up tasks, and exporting deadlines.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
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
