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
      <div className="console-brain-art" aria-hidden="true">
        <img className="console-brain" src="/assets/second-brain.svg" alt="" />
        <div className="brain-core-logo">
          <img src="/assets/guardiao-symbol.png" alt="" />
        </div>
      </div>
      <div className="console-brain-copy">
        <span className="brain-wordmark">GUARDIÃO</span>
        <h1>Seu Segundo Cérebro</h1>
        <p>
          Conecta o que você sabe.
          <br />
          Ilumina o próximo passo.
        </p>
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
