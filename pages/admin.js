import { useEffect, useState } from "react";

function LoginBox({ onLogin }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, pass }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Falha no login.");
        return;
      }
      onLogin();
    } catch {
      setError("Erro de conexao.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <form className="panel login-box" onSubmit={submit}>
        <h2 style={{ marginTop: 0, color: "#d4af5a" }}>Painel Admin</h2>
        {error && <div className="status-msg error">{error}</div>}
        <div className="field">
          <label>Usuario</label>
          <input value={user} onChange={(e) => setUser(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label>Senha</label>
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} />
        </div>
        <button className="btn-primary" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}

function StatusPill({ status }) {
  return <span className={`pill ${status}`}>{status}</span>;
}

function ManualForm({ onCreated }) {
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [color, setColor] = useState("preto");
  const [status, setStatus] = useState("pago");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!name || number === "") {
      setError("Preencha nome e numero.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, number: Number(number), color, status }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao criar.");
        return;
      }
      setName("");
      setNumber("");
      onCreated();
    } catch {
      setError("Erro de conexao.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="panel" onSubmit={submit} style={{ marginBottom: 24 }}>
      <h3 style={{ marginTop: 0 }}>Adicionar / marcar reserva manualmente</h3>
      {error && <div className="status-msg error">{error}</div>}
      <div className="manual-form">
        <div className="field">
          <label>Nome</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Marcel" />
        </div>
        <div className="field">
          <label>Numero</label>
          <input
            type="number"
            min={0}
            max={100}
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="10"
          />
        </div>
        <div className="field">
          <label>Cor</label>
          <select value={color} onChange={(e) => setColor(e.target.value)}>
            <option value="preto">Preto</option>
            <option value="branco">Branco</option>
          </select>
        </div>
        <div className="field">
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="pago">Pago</option>
            <option value="pendente">Pendente</option>
            <option value="rejeitado">Rejeitado</option>
          </select>
        </div>
        <div className="field" />
        <button className="btn-primary" style={{ width: "auto", padding: "12px 18px" }} disabled={busy}>
          {busy ? "..." : "Adicionar"}
        </button>
      </div>
    </form>
  );
}

export default function Admin() {
  const [authed, setAuthed] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [summary, setSummary] = useState(null);
  const [tab, setTab] = useState("lista");
  const [filterColor, setFilterColor] = useState("preto");

  const checkAuth = async () => {
    const res = await fetch("/api/admin/me");
    const data = await res.json();
    setAuthed(data.authenticated);
  };

  const load = async () => {
    const res = await fetch("/api/admin/list");
    if (res.status === 401) {
      setAuthed(false);
      return;
    }
    const data = await res.json();
    setReservations(data.reservations);
    setSummary(data.summary);
  };

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (authed) load();
  }, [authed]);

  const updateStatus = async (id, status) => {
    await fetch("/api/admin/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    load();
  };

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthed(false);
  };

  if (authed === null) {
    return <div className="page" />;
  }

  if (!authed) {
    return (
      <div className="page">
        <LoginBox onLogin={() => setAuthed(true)} />
      </div>
    );
  }

  const activeByColor = { preto: {}, branco: {} };
  reservations
    .filter((r) => r.active)
    .forEach((r) => {
      activeByColor[r.color][r.number] = r;
    });

  return (
    <div className="page">
      <div className="admin-shell">
        <div className="admin-sidebar">
          <h3>WAAW · Admin</h3>
          <div className="admin-stat">
            <div className="label">Total de reservas</div>
            <div className="value">{summary?.total ?? "-"}</div>
          </div>
          <div className="admin-stat">
            <div className="label">Pagos</div>
            <div className="value" style={{ color: "#4caf6b" }}>
              {summary?.pagos ?? "-"}
            </div>
          </div>
          <div className="admin-stat">
            <div className="label">Pendentes (aguardando)</div>
            <div className="value" style={{ color: "#e0b24f" }}>
              {summary?.pendentes ?? "-"}
            </div>
          </div>
          <div className="admin-stat">
            <div className="label">Faturamento confirmado</div>
            <div className="value">
              {(summary?.faturamentoConfirmado ?? 0).toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </div>
          </div>
          {summary && (
            <div className={`status-msg ${summary.usingSupabase ? "success" : "info"}`} style={{ fontSize: 11 }}>
              {summary.usingSupabase
                ? "Banco: Supabase conectado. Numeros e pagamentos persistidos no banco."
                : "Modo local: configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY para producao."}
            </div>
          )}
          <a href="/" className="admin-link" style={{ textAlign: "center" }}>
            ← Voltar a loja
          </a>
          <button className="remove-btn" onClick={logout} style={{ marginTop: "auto" }}>
            Sair
          </button>
        </div>

        <div className="admin-main">
          <div className="tabbar">
            <button className={tab === "lista" ? "active" : ""} onClick={() => setTab("lista")}>
              Lista de reservas
            </button>
            <button className={tab === "grade" ? "active" : ""} onClick={() => setTab("grade")}>
              Grade de numeros (0-100)
            </button>
          </div>

          <ManualForm onCreated={load} />

          {tab === "lista" && (
            <div className="panel">
              <table>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Numero</th>
                    <th>Cor</th>
                    <th>Status</th>
                    <th>Valor</th>
                    <th>Contato</th>
                    <th>Criado em</th>
                    <th>Obs</th>
                    <th>Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {reservations.map((r) => (
                    <tr key={r.id}>
                      <td>{r.name}</td>
                      <td>{r.number}</td>
                      <td style={{ textTransform: "capitalize" }}>{r.color}</td>
                      <td>
                        <StatusPill status={r.status} />
                      </td>
                      <td>
                        {Number(r.amount || 0).toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </td>
                      <td>{r.contact || "-"}</td>
                      <td>{new Date(r.createdAt).toLocaleString("pt-BR")}</td>
                      <td style={{ maxWidth: 220, whiteSpace: "normal", fontSize: 11, color: "#9a9aa2" }}>
                        {r.obs || ""}
                      </td>
                      <td>
                        <div className="row-actions">
                          {r.status !== "pago" && (
                            <button className="ok" onClick={() => updateStatus(r.id, "pago")}>
                              Marcar pago
                            </button>
                          )}
                          {r.status !== "rejeitado" && (
                            <button className="no" onClick={() => updateStatus(r.id, "rejeitado")}>
                              Rejeitar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {reservations.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ textAlign: "center", color: "#9a9aa2" }}>
                        Nenhuma reserva ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tab === "grade" && (
            <div className="panel">
              <div className="color-toggle" style={{ marginBottom: 16, width: "fit-content" }}>
                <button
                  type="button"
                  className={filterColor === "preto" ? "active" : ""}
                  onClick={() => setFilterColor("preto")}
                >
                  Preto
                </button>
                <button
                  type="button"
                  className={filterColor === "branco" ? "active" : ""}
                  onClick={() => setFilterColor("branco")}
                >
                  Branco
                </button>
              </div>
              <div className="grid-101">
                {Array.from({ length: 101 }, (_, n) => n).map((n) => {
                  const r = activeByColor[filterColor][n];
                  const cls = r ? `${filterColor}-${r.status}` : "free";
                  return (
                    <div key={n} className={`cell-101 ${cls}`}>
                      <div className="num">{n}</div>
                      <div className="who">{r ? r.name : "livre"}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
