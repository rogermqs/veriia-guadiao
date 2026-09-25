"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () =>
      setDark(document.documentElement.dataset.theme === "dark");
    const system = () => {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem("guardiao-theme");
      } catch {}
      if (saved !== "light" && saved !== "dark")
        document.documentElement.dataset.theme = media.matches
          ? "dark"
          : "light";
      sync();
    };
    system();
    media.addEventListener("change", system);
    return () => media.removeEventListener("change", system);
  }, []);
  function toggle() {
    const theme = dark ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("guardiao-theme", theme);
    } catch {}
    setDark(!dark);
  }
  return (
    <button
      className="theme-toggle"
      type="button"
      onClick={toggle}
      aria-label={dark ? "Ativar modo claro" : "Ativar modo escuro"}
      title={dark ? "Ativar modo claro" : "Ativar modo escuro"}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
      <span>{dark ? "Claro" : "Escuro"}</span>
    </button>
  );
}
