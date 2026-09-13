"use client";
import { useEffect, useState } from "react";
import {
  HeartPulse,
  LayoutDashboard,
  MessagesSquare,
  Database,
  BookOpen,
  GitBranch,
  ClipboardCheck,
  Settings,
  LogOut,
  ChevronDown,
  Menu,
  ArrowUpRight,
  Landmark,
  Search,
  X,
} from "lucide-react";
import Health from "../../components/health";
import Dashboard from "../../components/dashboard";
import { request, Drawer, Source, ErrorBox } from "../../components/ui";
import Records from "../../components/records";
import Sources from "../../components/sources";
import Knowledge from "../../components/knowledge";
import Chat from "../../components/chat";
import Admin from "../../components/admin";
const navigation = [
  { id: "overview", label: "Visão geral", icon: LayoutDashboard },
  { id: "chat", label: "Assistente", icon: MessagesSquare },
  { id: "health", label: "Saúde", icon: HeartPulse },
  { id: "sources", label: "Fontes e importações", icon: Database },
  { id: "knowledge", label: "Conhecimento", icon: BookOpen },
  { id: "decisions", label: "Decisões", icon: GitBranch },
  { id: "commitments", label: "Compromissos", icon: ClipboardCheck },
];
export default function Application() {
  const [user, setUser] = useState<any>(null),
    [workspace, setWorkspace] = useState("demo"),
    [page, setPage] = useState("overview"),
    [mobile, setMobile] = useState(false),
    [source, setSource] = useState<any>(null),
    [error, setError] = useState("");
  useEffect(() => {
    request("/auth/me")
      .then((u) => {
        setUser(u);
        setWorkspace(
          u.workspaces.some((x: any) => x.id === "demo")
            ? "demo"
            : u.workspaces[0]?.id,
        );
      })
      .catch((e) => setError(e.message));
    const key = window.location.hash.slice(1);
    if ([...navigation.map((n) => n.id), "admin"].includes(key)) setPage(key);
  }, []);
  const w = user?.workspaces.find((v: any) => v.id === workspace);
  function navigate(id: string) {
    setPage(id);
    setMobile(false);
    window.history.replaceState(null, "", "#" + id);
  }
  if (!w)
    return (
      <div className="app-loading">
        <img src="/assets/guardiao.png" alt="Guardião" />
        <p>{error || "Preparando seu espaço de trabalho…"}</p>
      </div>
    );
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Pular para conteúdo
      </a>
      {mobile && (
        <button
          className="nav-scrim"
          aria-label="Fechar navegação"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? "is-open" : ""}`}>
        <a className="sidebar-brand" href="/">
          <img src="/assets/guardiao.png" alt="Guardião" />
          <span>SEU SEGUNDO CÉREBRO</span>
        </a>
        <div className="sidebar-workspace">
          <div className="workspace-mark">
            <Landmark size={20} />
          </div>
          <div>
            <strong>Guardião</strong>
            <small>Memória institucional</small>
          </div>
        </div>
        <div className="nav-label">ESPAÇO DE TRABALHO</div>
        <nav aria-label="Navegação do sistema">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              aria-label={label}
              className={page === id ? "selected" : ""}
              aria-current={page === id ? "page" : undefined}
              onClick={() => navigate(id)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {id === "chat" && <span className="ai-label">IA</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="green-dot" />
            <div>
              Conhecimento que fica.<small>Decisões que avançam.</small>
            </div>
          </div>
          {w.role === "admin" && (
            <button
              className={`nav-admin ${page === "admin" ? "selected" : ""}`}
              onClick={() => navigate("admin")}
            >
              <Settings size={18} />
              Administração
            </button>
          )}
          <div className="user-row">
            <span className="avatar">{user.name[0]}</span>
            <span>
              <strong>{user.name}</strong>
              <small>
                {
                  {
                    admin: "Administrador",
                    manager: "Gestor",
                    analyst: "Analista",
                    reader: "Leitor",
                  }[w.role]
                }
              </small>
            </span>
            <button
              className="icon-btn"
              aria-label="Sair do sistema"
              onClick={() =>
                request("/auth/logout", {}, "POST")
                  .then(() => window.location.assign("/login"))
                  .catch((e) => setError(e.message))
              }
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <div className="topbar-context">
            <button
              className="icon-btn mobile-menu"
              aria-label="Abrir navegação"
              aria-expanded={mobile}
              onClick={() => setMobile(!mobile)}
            >
              <Menu size={21} />
            </button>
            <Landmark className="topbar-building" size={17} />
            <select
              aria-label="Espaço de trabalho"
              value={workspace}
              onChange={(e) => {
                setWorkspace(e.target.value);
                setSource(null);
                navigate("overview");
              }}
            >
              {user.workspaces.map((v: any) => (
                <option value={v.id} key={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
            <span
              className={`origin-pill ${w.id === "demo" ? "simulated" : "public"}`}
            >
              {w.id === "demo" ? "SIMULAÇÃO" : "DADOS PÚBLICOS"}
            </span>
          </div>
          <div className="topbar-right">
            <span>Guardião — Segundo Cérebro</span>
            <span className="topbar-avatar">{user.name[0]}</span>
          </div>
        </header>
        <main
          id="main"
          className={`content ${page === "chat" ? "chat-page-content" : ""}`}
          key={`${workspace}:${page}`}
        >
          <ErrorBox message={error} />
          {page === "overview" && (
            <Dashboard w={w} navigate={navigate} onSource={setSource} />
          )}{" "}
          {page === "chat" && <Chat w={w} onSource={setSource} />}{" "}
          {page === "health" && <Health w={w} onSource={setSource} />}
          {page === "sources" && <Sources w={w} onSource={setSource} />}{" "}
          {page === "knowledge" && <Knowledge w={w} onSource={setSource} />}{" "}
          {(page === "decisions" || page === "commitments") && (
            <Records kind={page} w={w} onSource={setSource} />
          )}{" "}
          {page === "admin" && <Admin w={w} />}
        </main>
        <footer className="app-footer">
          <span>
            Guardião <span>· Segundo Cérebro</span>
          </span>
          <span>
            {w.id === "demo"
              ? "Ambiente de demonstração · Dados fictícios"
              : "Dados públicos · Curitiba"}{" "}
            <span className="dot-divider">·</span> Conhecimento com origem.
          </span>
        </footer>
      </div>
      {source && (
        <Drawer title="Fonte e contexto" onClose={() => setSource(null)}>
          <Source data={source} />
        </Drawer>
      )}
    </div>
  );
}
