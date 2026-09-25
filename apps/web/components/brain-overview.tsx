import { ArrowUpRight } from "lucide-react";
import BrainArtwork from "./brain-artwork";
const areas = [
  ["health", "Saúde", "Histórico e atendimento"],
  ["finance", "Financeiro", "Orçamento e prioridades", "chat"],
  ["contracts", "Contratos", "Prazos e fornecedores", "chat"],
  ["sources", "Dados", "Fontes do município"],
  ["knowledge", "Conhecimento", "Memória institucional"],
  ["decisions", "Decisões", "Contexto para agir"],
  ["commitments", "Compromissos", "Próximos passos"],
];
export default function BrainOverview({
  navigate,
}: {
  navigate: (id: string) => void;
}) {
  return (
    <section
      className="brain-overview"
      aria-label="Segundo Cérebro do município"
    >
      <div className="brain-overview-copy">
        <span className="eyebrow">GUARDIÃO / INTELIGÊNCIA CONECTADA</span>
        <h2>
          Seu município.
          <br />
          Um Segundo Cérebro.
        </h2>
        <p>
          Conecte informações, encontre contexto e transforme conhecimento em
          decisões.
        </p>
        <button className="btn primary" onClick={() => navigate("chat")}>
          Conversar com o Guardião <ArrowUpRight size={17} />
        </button>
        <small>Visualização conceitual das áreas da gestão.</small>
      </div>
      <div className="brain-map">
        <svg
          className="brain-map-connections"
          viewBox="0 0 600 340"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M115 85 H190 L280 145 M490 65 H420 L345 130 M495 185 H425 L360 185 M105 230 H195 L275 215 M435 285 H380 L330 245" />
        </svg>
        <BrainArtwork />
        <div className="brain-area-links">
          {areas.map(([id, label, detail, destination = id], i) => (
            <button
              key={id}
              className={`brain-area area-${i}`}
              onClick={() => navigate(destination)}
            >
              <span className="area-dot" />
              <span>
                <strong>{label}</strong>
                <small>{detail}</small>
              </span>
              <ArrowUpRight size={13} />
            </button>
          ))}
        </div>
        <span className="brain-map-caption">DADOS · CONTEXTO · MEMÓRIA</span>
      </div>
    </section>
  );
}
