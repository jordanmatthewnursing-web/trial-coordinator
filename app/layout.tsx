import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trial Coordinator — Research Screening Workspace",
  description:
    "A source-grounded synthetic screening workspace for research-site coordinators, from protocol context to preliminary handoff.",
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
