import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Guardião | Segundo Cérebro",
  description:
    "Guardião — Segundo Cérebro. Dados, conhecimento e memória institucional.",
  robots: { index: false, follow: false },
  icons: { icon: "/assets/favicon.png" },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
