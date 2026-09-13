"use client";
import { useCallback, useEffect, useRef, useState } from "react";
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
export function useVoice(onText: (text: string) => void) {
  const [supported, setSupported] = useState(false),
    [canSpeak, setCanSpeak] = useState(false),
    [listening, setListening] = useState(false),
    [speaking, setSpeaking] = useState(false),
    [error, setError] = useState("");
  const recognition = useRef<Recognition | null>(null),
    utterance = useRef<SpeechSynthesisUtterance | null>(null),
    epoch = useRef(0),
    textCallback = useRef(onText),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  textCallback.current = onText;
  const stop = useCallback(() => {
    epoch.current++;
    const r = recognition.current;
    recognition.current = null;
    if (r) {
      r.onstart = r.onresult = r.onerror = r.onend = null;
      try {
        r.abort();
      } catch {}
    }
    if (timer.current) clearTimeout(timer.current);
    if (utterance.current) {
      utterance.current.onend =
        utterance.current.onerror =
        utterance.current.onstart =
          null;
      utterance.current = null;
      window.speechSynthesis?.cancel();
    }
    setListening(false);
    setSpeaking(false);
  }, []);
  useEffect(() => {
    setSupported(
      !!(
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition
      ) && window.isSecureContext,
    );
    setCanSpeak("speechSynthesis" in window);
    const hide = () => {
      if (document.hidden) stop();
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      stop();
    };
  }, [stop]);
  function dictate(prefix: string) {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    stop();
    setError("");
    const Constructor =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!Constructor) {
      setError(
        "Este navegador não oferece ditado. Você pode continuar por texto.",
      );
      return;
    }
    const r: Recognition = new Constructor(),
      id = epoch.current;
    recognition.current = r;
    r.lang = "pt-BR";
    r.continuous = false;
    r.interimResults = true;
    r.onstart = () => {
      if (id === epoch.current) setListening(true);
    };
    r.onresult = (e: any) => {
      if (id !== epoch.current) return;
      const text = Array.from(e.results, (v: any) => v[0].transcript).join(" ");
      textCallback.current(
        [prefix.trim(), text.trim()].filter(Boolean).join(" ").slice(0, 8000),
      );
    };
    r.onend = () => {
      if (id !== epoch.current) return;
      setListening(false);
      recognition.current = null;
      if (timer.current) clearTimeout(timer.current);
    };
    r.onerror = (e: any) => {
      if (id !== epoch.current) return;
      stop();
      setError(
        e.error === "not-allowed" || e.error === "service-not-allowed"
          ? "Microfone bloqueado. Permita o acesso nas configurações do navegador e tente novamente."
          : e.error === "no-speech"
            ? "Não foi possível ouvir a pergunta. Tente novamente."
            : e.error === "audio-capture"
              ? "Nenhum microfone disponível. Confira a conexão do dispositivo."
              : "O ditado ficou indisponível. Tente novamente ou continue por texto.",
      );
    };
    try {
      r.start();
      setListening(true);
      timer.current = setTimeout(() => {
        if (id === epoch.current) r.stop();
      }, 60000);
    } catch {
      stop();
      setError("Não foi possível iniciar o microfone. Tente novamente.");
    }
  }
  const speak = useCallback(
    (text: string) => {
      stop();
      setError("");
      if (!window.speechSynthesis) {
        setError("Leitura em voz alta indisponível neste navegador.");
        return;
      }
      const id = epoch.current;
      const chunks =
        text
          .replace(/[*#`]/g, "")
          .match(/[\s\S]{1,220}(?:\s|$)|[\s\S]{1,220}/g) || [];
      function next() {
        if (id !== epoch.current) return;
        const chunk = chunks.shift();
        if (!chunk) {
          utterance.current = null;
          setSpeaking(false);
          return;
        }
        const u = new SpeechSynthesisUtterance(chunk);
        u.lang = "pt-BR";
        const voice = window.speechSynthesis
          .getVoices()
          .find((v) => v.lang.toLowerCase() === "pt-br");
        if (voice) u.voice = voice;
        u.onend = next;
        u.onerror = (e) => {
          if (id !== epoch.current) return;
          stop();
          if (e.error !== "canceled" && e.error !== "interrupted")
            setError(
              "Não foi possível reproduzir a resposta. Use Ouvir resposta para tentar novamente.",
            );
        };
        utterance.current = u;
        setSpeaking(true);
        window.speechSynthesis.speak(u);
      }
      next();
    },
    [stop],
  );
  return {
    supported,
    canSpeak,
    listening,
    speaking,
    error,
    dictate,
    speak,
    stop,
  };
}
