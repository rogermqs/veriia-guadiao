"use client";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  LockKeyhole,
  Eye,
  EyeOff,
  Landmark,
  Database,
  MessagesSquare,
  ClipboardCheck,
} from "lucide-react";
export default function Login() {
  const [visible, setVisible] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      const r = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      const j = await r.json();
      if (!r.ok) throw Error(j.message);
      window.location.assign("/agm");
    } catch (e: any) {
      setError(e.message || "Não foi possível conectar ao sistema.");
      setBusy(false);
    }
  }
  return (
    <main className="login">
      <section className="login-story">
        <a href="/" className="login-brand">
          <img src="/assets/guardiao.png" alt="Guardião" />
        </a>
        <div className="story-copy">
          <div className="overline">
            <span /> INTELIGÊNCIA PARA A GESTÃO PÚBLICA
          </div>
          <h1>
            Mais contexto.
            <br />
            Melhores decisões.
            <br />
            <em>Seu Segundo Cérebro.</em>
          </h1>
          <p>
            Conecte dados, conhecimento e memória institucional para transformar
            a gestão do seu município.
          </p>
          <div className="story-features">
            <span>
              <Database size={19} />
              Dados com origem verificável
            </span>
            <span>
              <MessagesSquare size={19} />
              Conhecimento que permanece
            </span>
            <span>
              <ClipboardCheck size={19} />
              Compromissos acompanhados
            </span>
          </div>
        </div>
        <div className="story-bottom">
          <span>GUARDIÃO · SEU SEGUNDO CÉREBRO</span>
          <span>01 / GESTÃO CONECTADA</span>
        </div>
      </section>
      <section className="login-form-area">
        <a href="/" className="back-site">
          Voltar ao site <ArrowUpRight size={15} />
        </a>
        <div className="login-form-wrap">
          <div className="app-mark">
            <img
              src="/assets/guardiao-symbol.png"
              alt=""
              width="36"
              height="38"
            />
          </div>
          <span className="eyebrow">SEU ESPAÇO DE TRABALHO</span>
          <h2>Bem-vindo ao Guardião</h2>
          <p>Acesse o Guardião — Segundo Cérebro.</p>
          <form onSubmit={submit}>
            <label>
              E-mail
              <input
                name="email"
                type="email"
                autoComplete="username"
                placeholder="seu.email@municipio.gov.br"
                required
                autoFocus
              />
            </label>
            <label>
              Senha
              <div className="password-input">
                <input
                  name="password"
                  type={visible ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Digite sua senha"
                  required
                />
                <button
                  type="button"
                  aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
            <button className="btn primary login-submit" disabled={busy}>
              {busy ? "Entrando…" : "Entrar no sistema"}
              <ArrowRight size={18} />
            </button>
          </form>
          <div className="login-note">
            <LockKeyhole size={16} />
            <p>
              Acesso interno. Utilize a conta disponibilizada pelo administrador
              da demonstração.
            </p>
          </div>
        </div>
        <footer>
          Uma solução <strong>veriia</strong>
          <span>Dados que orientam. Memória que conecta.</span>
        </footer>
      </section>
    </main>
  );
}
