"use client";
import { useEffect, useRef, useState } from "react";
import { Maximize2, X } from "lucide-react";
import BrainArtwork from "./brain-artwork";

export const specialists = [
  {
    id: "gestao",
    title: "Gestão",
    connections: ["Demandas", "Decisões", "Compromissos"],
    prompt: "Quais demandas e compromissos exigem atenção da gestão?",
  },
  {
    id: "financeiro",
    title: "Financeiro",
    connections: ["Orçamento", "Prioridades", "Contratos"],
    prompt:
      "Quais demandas e decisões ajudam a priorizar o orçamento? Mostre as fontes disponíveis e indique os dados financeiros que faltam.",
  },
  {
    id: "contratos",
    title: "Contratos",
    connections: ["Fornecedores", "Prazos", "Compromissos"],
    prompt:
      "Quais compromissos e decisões impactam contratos ou fornecedores? Mostre os prazos disponíveis e as fontes.",
  },
  {
    id: "saude",
    title: "Saúde",
    connections: ["UBS", "Atendimentos", "Visitas"],
    prompt:
      "Quais informações de atendimentos e visitas de saúde estão disponíveis neste espaço?",
  },
] as const;

export default function ChatIntelligence({
  selected,
  onSelect,
  onPrompt,
  busy,
  status,
}: {
  selected: string;
  onSelect: (id: string) => void;
  onPrompt: (text: string) => void;
  busy: boolean;
  status?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (expanded) dialog.current?.showModal();
  }, [expanded]);
  const specialist =
    specialists.find((s) => s.id === selected) || specialists[0];
  const connections = (
    <div className="connection-panel">
      <span className="eyebrow">CONEXÕES PARA EXPLORAR</span>
      <div className="connection-nodes">
        {specialist.connections.map((c) => (
          <span key={c}>{c}</span>
        ))}
      </div>
      <p>
        Contextos sugeridos. As fontes consultadas aparecem junto à resposta.
      </p>
    </div>
  );
  return (
    <div className="chat-intelligence">
      <div className="intelligence-toolbar">
        <div
          className="specialist-switch"
          role="group"
          aria-label="Especialistas do Guardião"
        >
          {specialists.map((s) => (
            <button
              type="button"
              key={s.id}
              disabled={busy}
              aria-pressed={selected === s.id}
              onClick={() => onSelect(s.id)}
            >
              {s.title}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="brain-expand"
          aria-label="Expandir Segundo Cérebro"
          title="Expandir Segundo Cérebro"
          onClick={() => setExpanded(true)}
        >
          <Maximize2 size={16} />
        </button>
      </div>
      <details className="intelligence-details">
        <summary>Explorar conexões e roteiros</summary>
        <div className="intelligence-detail-body">
          {connections}
          <div className="guided-demo">
            <strong>Roteiro de {specialist.title}</strong>
            <p>{specialist.prompt}</p>
            <button
              type="button"
              className="btn secondary"
              disabled={busy}
              onClick={() => onPrompt(specialist.prompt)}
            >
              Usar roteiro de {specialist.title}
            </button>
            <small>Revise a pergunta antes de enviar.</small>
          </div>
        </div>
      </details>
      <dialog
        ref={dialog}
        className="expanded-brain-dialog"
        aria-labelledby="expanded-brain-title"
        onClose={() => setExpanded(false)}
      >
        {expanded && (
          <>
            <button
              type="button"
              className="brain-dialog-close"
              aria-label="Fechar cérebro expandido"
              onClick={() => dialog.current?.close()}
            >
              <X size={20} />
            </button>
            <span className="eyebrow">GUARDIÃO · {specialist.title}</span>
            <h2 id="expanded-brain-title">Segundo Cérebro expandido</h2>
            <BrainArtwork active={busy} className="expanded-brain-art" />
            <p role="status">
              {busy
                ? status || "Preparando consulta…"
                : "Pronto para conectar o contexto do município."}
            </p>
            {connections}
          </>
        )}
      </dialog>
    </div>
  );
}

export function AnalysisSteps({ progress }: { progress: string }) {
  const current = /resposta/i.test(progress)
    ? 2
    : /consultando|lendo/i.test(progress)
      ? 1
      : 0;
  return (
    <ol className="analysis-steps" aria-label="Etapa da consulta">
      {["Pergunta", "Consulta", "Resposta"].map((label, i) => (
        <li key={label} aria-current={i === current ? "step" : undefined}>
          {label}
        </li>
      ))}
    </ol>
  );
}
