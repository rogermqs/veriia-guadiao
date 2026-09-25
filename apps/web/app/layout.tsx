import type { Metadata } from "next";
import "./globals.css";
import "./neural-theme.css";
export const metadata: Metadata = {
  title: "Guardião | Segundo Cérebro",
  description:
    "Guardião — Segundo Cérebro. Dados, conhecimento e memória institucional.",
  robots: { index: false, follow: false },
  icons: { icon: "/assets/favicon.png" },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t;try{t=localStorage.getItem('guardiao-theme')}catch(e){}document.documentElement.dataset.theme=t==='dark'||t==='light'?t:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'})()`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
