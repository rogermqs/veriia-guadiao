"use client";
import { useEffect, useRef, useState } from "react";
import {
  Mic,
  Volume2,
  VolumeX,
  HeartPulse,
  Plus,
  ArrowUp,
  ArrowUpRight,
  Download,
  MessagesSquare,
  BookOpen,
  BarChart3,
  ClipboardList,
  StopCircle,
  Info,
  Paperclip,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { request, download, ErrorBox, ResultTable } from "./ui";
import { useVoice } from "./use-voice";
import SecondBrain from "./second-brain";
export default function Chat({ w, onSource }: any) {
  const base = `/workspaces/${w.id}`;
  const [conversations, setConversations] = useState<any[]>([]),
    [current, setCurrent] = useState<string | null>(null),
    [turns, setTurns] = useState<any[]>([]),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(""),
    [write, setWrite] = useState(false),
    [provider, setProvider] = useState(true),
    [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const voice = useVoice(setMessage);
  const [autoVoice, setAutoVoice] = useState(false);
  const autoVoiceRef = useRef(false);
  autoVoiceRef.current = autoVoice;
  const viewEpoch = useRef(0);
  const stream = useRef<EventSource | null>(null),
    active = useRef<string | null>(null),
    bottom = useRef<HTMLDivElement>(null);
  function refreshList() {
    request(base + "/conversations")
      .then((r) => setConversations(r.items))
      .catch((e) => setError(e.message));
  }
  useEffect(() => {
    refreshList();
    request(base + "/capabilities")
      .then((r) => setProvider(r.provider_configured))
      .catch(() => {});
    return () => stream.current?.close();
  }, []);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest" });
  }, [turns, progress]);
  async function select(id: string) {
    voice.stop();
    viewEpoch.current++;
    stream.current?.close();
    stream.current = null;
    setWrite(false);
    setCurrent(id);
    setError("");
    setBusy(false);
    const c = await request(base + "/conversations/" + id);
    setTurns(c.turns);
    const pending = c.turns.find((t: any) =>
      ["queued", "running"].includes(t.status),
    );
    if (pending) {
      setBusy(true);
      listen(id, pending.id);
    }
  }
  async function loadTurns(conv: string, readTurn?: string) {
    const epoch = viewEpoch.current;
    const c = await request(base + "/conversations/" + conv);
    if (epoch !== viewEpoch.current) return;
    setTurns(c.turns);
    if (readTurn && autoVoiceRef.current) {
      const answer = c.turns.find((t: any) => t.id === readTurn)?.answer;
      if (answer?.text) voice.speak(answer.text);
    }
  }
  function listen(conv: string, id: string) {
    active.current = id;
    const es = new EventSource(
      base.replace("/workspaces", "/api/v1/workspaces") +
        `/conversations/${conv}/turns/${id}/events`,
    );
    stream.current = es;
    es.addEventListener("turn.status", (e) => {
      if (stream.current === es)
        setProgress(JSON.parse((e as MessageEvent).data).message);
    });
    es.addEventListener("write.persisted", () => {
      if (stream.current === es)
        setProgress("Registro salvo. Preparando a resposta.");
    });
    for (const name of ["answer.ready", "turn.failed", "turn.cancelled"])
      es.addEventListener(name, () => {
        if (stream.current !== es) return;
        es.close();
        setBusy(false);
        setProgress("");
        loadTurns(conv, name === "answer.ready" ? id : undefined).catch((e) =>
          setError(e.message),
        );
        refreshList();
      });
    es.onerror = () => {
      if (stream.current !== es) return;
      es.close();
      setBusy(false);
      setProgress("");
      loadTurns(conv).catch((e) => setError(e.message));
    };
  }
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() || busy || voice.listening) return;
    voice.stop();
    setError("");
    setBusy(true);
    const text = message;
    try {
      let conv = current;
      if (!conv) {
        const c = await request(base + "/conversations", {});
        conv = c.id;
        setCurrent(conv);
      }
      const r = await request(
        base + `/conversations/${conv}/turns`,
        { message: text, allow_write: write },
        "POST",
        { "Idempotency-Key": crypto.randomUUID() },
      );
      setTurns((v) => [
        ...v,
        { id: r.turn_id, message: text, status: "queued" },
      ]);
      setMessage("");
      setWrite(false);
      setProgress("Preparando consulta");
      listen(conv!, r.turn_id);
      refreshList();
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  }
  return (
    <div className="chat-layout">
      <aside
        className={`conversation-sidebar ${sidebarCollapsed ? "is-collapsed" : ""}`}
      >
        <button
          className="btn secondary sidebar-collapse-btn"
          onClick={() => setSidebarCollapsed((v) => !v)}
          title={sidebarCollapsed ? "Abrir sidebar" : "Minimizar sidebar"}
          aria-label={sidebarCollapsed ? "Abrir sidebar" : "Minimizar sidebar"}
        >
          {sidebarCollapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
          <span className="sidebar-action-label">
            {sidebarCollapsed ? "Abrir sidebar" : "Minimizar"}
          </span>
        </button>
        <button
          className="btn secondary sidebar-new-conversation"
          onClick={() => {
            voice.stop();
            viewEpoch.current++;
            stream.current?.close();
            stream.current = null;
            setMessage("");
            setWrite(false);
            setCurrent(null);
            setTurns([]);
            setError("");
            setBusy(false);
            setProgress("");
          }}
        >
          <Plus size={17} />
          <span className="sidebar-action-label">Nova conversa</span>
        </button>
        <div className="nav-label">CONVERSAS RECENTES</div>
        {conversations.map((c) => (
          <button
            className={`conversation-link ${current === c.id ? "active" : ""}`}
            key={c.id}
            onClick={() => select(c.id).catch((e) => setError(e.message))}
          >
            <MessagesSquare size={15} />
            <span>{c.title}</span>
          </button>
        ))}
        <div className="chat-memory-note">
          <BookOpen size={19} />
          <p>
            A conversa muda.
            <br />
            <strong>O conhecimento permanece.</strong>
          </p>
          <small>
            Decisões e compromissos são compartilhados dentro deste espaço.
          </small>
        </div>
      </aside>
      <section className="chat-main">
        <SecondBrain
          active={busy || voice.listening || voice.speaking}
          status={
            voice.listening
              ? "Ouvindo você…"
              : voice.speaking
                ? "Falando com você…"
                : undefined
          }
        />
        <div className="chat-messages">
          {!turns.length ? (
            <div className="chat-welcome">
              <span className="eyebrow">CONTEXTO PARA DECIDIR</span>
              <h2>O que vamos entender hoje?</h2>
              <p>
                Explore os registros, consulte decisões anteriores
                <br />e acompanhe os próximos passos da gestão.
              </p>
              <div className="suggestions">
                {[
                  ...(w.id === "demo"
                    ? [
                        [
                          HeartPulse,
                          "Consultar saúde",
                          "Qual UBS atendeu Maria Oliveira e qual agente a visitou?",
                        ],
                      ]
                    : []),
                  [
                    BarChart3,
                    "Entender as demandas",
                    "Quais bairros têm mais registros neste mês?",
                  ],
                  [
                    BookOpen,
                    "Consultar o contexto",
                    "O que mudou na decisão sobre o bairro Norte?",
                  ],
                  [
                    ClipboardList,
                    "Acompanhar compromissos",
                    "Quais compromissos de Obras estão em aberto?",
                  ],
                ].map(([Icon, title, text]: any) => (
                  <button key={title} onClick={() => setMessage(text)}>
                    <Icon size={20} />
                    <strong>{title}</strong>
                    <span>{text}</span>
                    <ArrowUpRight size={16} />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            turns.map((t) => (
              <div className="turn" key={t.id}>
                <div className="user-message">{t.message}</div>
                {t.answer && (
                  <article className="assistant-answer">
                    <span className="assistant-avatar small">
                      <img src="/assets/guardiao-symbol.png" alt="" />
                    </span>
                    <div>
                      <p className="answer-text">{t.answer.text}</p>
                      {t.answer.queries?.map((q: any) => (
                        <div className="answer-query" key={q.id}>
                          <small>
                            Base de {q.data_as_of} ·{" "}
                            {q.origin_kind === "synthetic_demo"
                              ? "SIMULAÇÃO"
                              : "DADOS PÚBLICOS"}
                          </small>
                          <ResultTable result={q.result} />
                        </div>
                      ))}
                      {t.answer.limitations?.map((l: string) => (
                        <p className="muted" key={l}>
                          {l}
                        </p>
                      ))}
                      <div className="answer-sources">
                        {voice.canSpeak && (
                          <button onClick={() => voice.speak(t.answer.text)}>
                            <Volume2 size={14} />
                            Ouvir resposta
                          </button>
                        )}
                        {t.answer.evidence_ids.map((id: string, i: number) => (
                          <button
                            key={id}
                            onClick={() =>
                              request(base + "/sources/" + id)
                                .then(onSource)
                                .catch((e) => setError(e.message))
                            }
                          >
                            <BookOpen size={13} />
                            Fonte {i + 1}
                            <ArrowUpRight size={12} />
                          </button>
                        ))}
                        <button
                          onClick={() =>
                            download(
                              base + "/exports/briefing",
                              { conversation_id: current, turn_id: t.id },
                              "agm-briefing.md",
                            ).catch((e) => setError(e.message))
                          }
                        >
                          <Download size={13} />
                          Exportar briefing
                        </button>
                      </div>
                    </div>
                  </article>
                )}
                {t.error && (
                  <div className="turn-error">
                    <Info size={18} />
                    <p>{t.error.message}</p>
                  </div>
                )}
              </div>
            ))
          )}
          {busy && (
            <p className="chat-progress">
              <span className="pulse-dot" />
              {progress || "Processando consulta…"}
            </p>
          )}
          <div ref={bottom} />
        </div>
        <div className="composer-area">
          <ErrorBox message={error || voice.error} />
          <div className="voice-controls">
            <button
              type="button"
              className={`btn secondary ${voice.listening ? "voice-listening" : ""}`}
              disabled={!voice.supported || busy}
              onClick={() => voice.dictate(message)}
              aria-pressed={voice.listening}
              aria-label={voice.listening ? "Parar ditado" : "Ditar pergunta"}
            >
              <Mic size={16} />
              {voice.listening ? "Parar ditado" : "Ditar pergunta"}
            </button>
            {voice.canSpeak && (
              <label>
                <input
                  type="checkbox"
                  checked={autoVoice}
                  onChange={(e) => {
                    setAutoVoice(e.target.checked);
                    if (!e.target.checked) voice.stop();
                  }}
                />
                Ouvir respostas automaticamente
              </label>
            )}
            {voice.speaking && (
              <button
                type="button"
                className="btn secondary"
                onClick={voice.stop}
              >
                <VolumeX size={16} />
                Parar áudio
              </button>
            )}
          </div>
          <p className="voice-help">
            {voice.supported
              ? "Dite, revise e envie. O navegador pode processar o áudio em seu serviço de voz."
              : "Este navegador não oferece ditado. Você pode continuar por texto."}
          </p>
          {!provider && (
            <div className="provider-note">
              <Info size={15} />
              Assistente aguardando configuração do provedor de IA. Consulte os
              dados e a memória pelo menu.
            </div>
          )}
          <form onSubmit={send} className="composer">
            <textarea
              aria-label="Mensagem para o assistente"
              placeholder="Pergunte sobre os dados e a gestão do município…"
              disabled={voice.listening}
              maxLength={8000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <div className="composer-bottom">
              <span>
                <BookOpen size={14} />
                Contexto do espaço atual
              </span>
              {busy ? (
                <button
                  className="send-button"
                  type="button"
                  aria-label="Cancelar consulta"
                  onClick={() =>
                    request(
                      base +
                        `/conversations/${current}/turns/${active.current}/cancel`,
                      {},
                    ).catch((e) => setError(e.message))
                  }
                >
                  <StopCircle size={20} />
                </button>
              ) : (
                <button
                  className="send-button"
                  disabled={!message.trim() || voice.listening}
                  aria-label="Enviar mensagem"
                >
                  <ArrowUp size={21} />
                </button>
              )}
            </div>
          </form>
          {w.id === "demo" && ["admin", "manager"].includes(w.role) && (
            <label className="chat-write-toggle">
              <input
                type="checkbox"
                checked={write}
                onChange={(e) => setWrite(e.target.checked)}
              />
              Permitir o registro solicitado nesta mensagem
            </label>
          )}
          <p className="chat-disclaimer">
            Confira as fontes. Sugestões do assistente não constituem decisões
            registradas.
          </p>
        </div>
      </section>
    </div>
  );
}
