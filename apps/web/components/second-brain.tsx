import BrainArtwork from "./brain-artwork";
export default function SecondBrain({
  active = false,
  status,
}: {
  active?: boolean;
  status?: string;
}) {
  return (
    <header
      className={`second-brain-console ${active ? "is-thinking" : ""}`}
      aria-label="Guardião, seu Segundo Cérebro"
      aria-busy={active}
    >
      <BrainArtwork active={active} className="console-neural-art" />
      <div className="console-brain-copy">
        <span className="brain-wordmark">GUARDIÃO</span>
        <h1>Seu Segundo Cérebro</h1>
        <p>
          Conecta o que você sabe.
          <br />
          Ilumina o próximo passo.
        </p>
        <div className="brain-domains" aria-hidden="true">
          <span>Saúde</span>
          <span>Financeiro</span>
          <span>Contratos</span>
          <span>Decisões</span>
        </div>
        <div className="brain-cycle" aria-hidden="true">
          <span className={active ? "is-hot" : ""}>Escuta</span>
          <span className={active ? "is-hot" : ""}>Contexto</span>
          <span className={active ? "is-hot" : ""}>Contratos</span>
          <span className={active ? "is-hot" : ""}>Decisão</span>
        </div>
        <div className="brain-state" role="status">
          <span />
          {status ||
            (active
              ? "Conectando informações…"
              : "Pronto para pensar com você")}
        </div>
      </div>
    </header>
  );
}
