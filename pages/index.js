import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

const IMGS = {
  preto: { front: "/img/black_front.png", back: "/img/black_back.png" },
  branco: { front: "/img/white_front.png", back: "/img/white_back.png" },
};

const SIZES = ["PP", "P", "M", "G", "GG", "XG"];

// Posicao (em % da altura/largura da imagem das costas) da area em branco
// reservada para nome e numero em cada camisa. Ajustado visualmente a
// partir das imagens reais enviadas (preto_atras.png / branco_atras.png).
const NAME_NUMBER_POS = {
  preto: { nameTop: 26, numberTop: 43 },
  branco: { nameTop: 26, numberTop: 43 },
};

function Viewer({ color, name, number }) {
  const [rotation, setRotation] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);
  const dragging = useRef(false);
  const lastX = useRef(0);
  const moved = useRef(false);

  useEffect(() => {
    if (!autoRotate) return;
    let raf;
    let last = performance.now();
    const tick = (t) => {
      const dt = t - last;
      last = t;
      setRotation((r) => r + dt * 0.03);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [autoRotate]);

  const onDown = (e) => {
    dragging.current = true;
    moved.current = false;
    setAutoRotate(false);
    lastX.current = e.touches ? e.touches[0].clientX : e.clientX;
  };
  const onMove = (e) => {
    if (!dragging.current) return;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const delta = x - lastX.current;
    if (Math.abs(delta) > 1) moved.current = true;
    lastX.current = x;
    setRotation((r) => r + delta * 0.6);
  };
  const onUp = () => {
    dragging.current = false;
  };

  const flip = () => {
    setAutoRotate(false);
    setRotation((r) => r + 180);
  };
  const step = (dir) => {
    setAutoRotate(false);
    setRotation((r) => r + dir * 45);
  };

  const normalized = ((rotation % 360) + 360) % 360;
  const showingBack = normalized > 90 && normalized < 270;
  // luz/sombra que varre a camisa conforme ela gira, para dar sensacao 3D real
  const lightAngle = Math.cos((normalized * Math.PI) / 180);
  const pos = NAME_NUMBER_POS[color];

  return (
    <div className="viewer">
      <div
        className="stage"
        onMouseDown={onDown}
        onMouseMove={onMove}
        onMouseUp={onUp}
        onMouseLeave={onUp}
        onTouchStart={onDown}
        onTouchMove={onMove}
        onTouchEnd={onUp}
        onDoubleClick={flip}
      >
        <div className="turntable-shadow" />
        <div className="card3d" style={{ transform: `rotateY(${rotation}deg)` }}>
          <div className="face front">
            <img src={IMGS[color].front} alt="Frente do uniforme" draggable={false} />
            <div className="sheen" style={{ opacity: 0.18 + 0.12 * lightAngle }} />
          </div>
          <div className="face back">
            <img src={IMGS[color].back} alt="Costas do uniforme" draggable={false} />
            <div
              className={`kit-name kit-name-${color}`}
              style={{ top: `${pos.nameTop}%` }}
            >
              {name ? name.toUpperCase() : "SEU NOME"}
            </div>
            <div
              className={`kit-number kit-number-${color}`}
              style={{ top: `${pos.numberTop}%` }}
            >
              {number !== "" && number !== null && number !== undefined ? number : "--"}
            </div>
            <div className="sheen" style={{ opacity: 0.18 - 0.12 * lightAngle }} />
          </div>
        </div>
      </div>

      <div className="viewer-controls">
        <button type="button" onClick={() => step(-1)} title="Girar para esquerda">
          ◀
        </button>
        <button
          type="button"
          className={autoRotate ? "active" : ""}
          onClick={() => setAutoRotate((a) => !a)}
        >
          {autoRotate ? "⏸ Pausar giro" : "▶ Girar automaticamente"}
        </button>
        <button type="button" onClick={() => step(1)} title="Girar para direita">
          ▶
        </button>
      </div>

      <div className="face-toggle">
        <button
          type="button"
          className={!showingBack ? "active" : ""}
          onClick={() => {
            setAutoRotate(false);
            setRotation(0);
          }}
        >
          Frente
        </button>
        <button
          type="button"
          className={showingBack ? "active" : ""}
          onClick={() => {
            setAutoRotate(false);
            setRotation(180);
          }}
        >
          Costas
        </button>
      </div>

      <div className="badge-name-number">
        {name ? name.toUpperCase() : "SEU NOME"} · Nº {number !== "" ? number : "--"}
      </div>
      <div className="hint">🖱️ Arraste para girar 360° · duplo clique para virar rápido</div>
    </div>
  );
}

export default function Home() {
  const [color, setColor] = useState("preto");
  const [buyerName, setBuyerName] = useState("");
  const [contact, setContact] = useState("");
  const [items, setItems] = useState([{ color: "preto", number: "", shirtSize: "M", shortsSize: "M" }]);
  const [availability, setAvailability] = useState({ taken: { preto: {}, branco: {} }, price: 49.9, maxUnitsPerNumber: 2 });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pixData, setPixData] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const loadAvailability = async () => {
    try {
      const res = await fetch("/api/availability");
      const data = await res.json();
      setAvailability(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadAvailability();
    const interval = setInterval(loadAvailability, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!pixData) return;
    setSecondsLeft(pixData.holdMinutes * 60);
    const t = setInterval(() => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [pixData]);

  const firstItem = items[0] || { color: "preto", number: "", shirtSize: "M", shortsSize: "M" };

  const updateItem = (idx, patch) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const MAX_ITEMS = 4;
  const MAX_PER_COLOR = 2;

  const countByColor = (list, c) => list.filter((it) => it.color === c).length;

  const addItem = () => {
    if (items.length >= MAX_ITEMS) return;
    // Escolhe automaticamente uma cor que ainda nao atingiu o limite de 2.
    const nextColor = countByColor(items, "preto") < MAX_PER_COLOR ? "preto" : "branco";
    setItems((prev) => [...prev, { color: nextColor, number: "", shirtSize: "M", shortsSize: "M" }]);
  };

  const removeItem = (idx) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const isTaken = (c, n) => {
    if (n === "" || n === null || n === undefined) return false;
    const entry = availability.taken?.[c]?.[Number(n)];
    const count = entry?.count || 0;
    return count >= (availability.maxUnitsPerNumber || 2);
  };

  const price = Number(availability.price || 49.9);
  const total = items.filter((it) => it.number !== "").length * price;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!buyerName.trim()) {
      setError("Digite o nome que vai no uniforme.");
      return;
    }
    const cleanItems = items.filter((it) => it.number !== "" && it.number !== null);
    if (cleanItems.length === 0) {
      setError("Escolha ao menos 1 numero.");
      return;
    }
    for (const it of cleanItems) {
      if (isTaken(it.color, it.number)) {
        setError(`O numero ${it.number} (${it.color}) ja nao esta disponivel.`);
        return;
      }
      if (!it.shirtSize || !it.shortsSize) {
        setError("Escolha o tamanho da camisa e do calcao para cada kit.");
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch("/api/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerName,
          contact,
          items: cleanItems.map((it) => ({
            number: Number(it.number),
            color: it.color,
            shirtSize: it.shirtSize,
            shortsSize: it.shortsSize,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao reservar.");
        await loadAvailability();
        return;
      }
      setPixData(data);
      const url = await QRCode.toDataURL(data.pixPayload, { width: 260, margin: 1 });
      setQrDataUrl(url);
      await loadAvailability();
    } catch (err) {
      console.error(err);
      setError("Erro de conexao. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const copyPix = async () => {
    if (!pixData) return;
    try {
      await navigator.clipboard.writeText(pixData.pixPayload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  const closeModal = () => {
    setPixData(null);
    setQrDataUrl("");
    setItems([{ color: "preto", number: "", shirtSize: "M", shortsSize: "M" }]);
    setBuyerName("");
    setContact("");
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className="page">
      <div className="topbar">
        <div className="brand">
          <span className="dot" />
          <div>
            WAAW <small>by Alok · softwaresul corp</small>
          </div>
        </div>
        <a className="admin-link" href="/admin">
          Painel Admin
        </a>
      </div>

      <div className="container">
        <div className="hero">
          <h1>Monte seu Kit Oficial</h1>
          <p>
            Escolha a cor, digite seu nome e numero e veja a simulacao em 360° na propria camisa.
            Cada pessoa pode escolher ate 4 numeros (maximo 2 por cor). Cada combinacao de numero
            + cor tem no maximo 2 unidades disponiveis — e so ficam garantidas depois que o Pix cair.
          </p>
        </div>

        <section className="kit-info panel">
          <div className="kit-info-heading">
            <div>
              <span className="eyebrow">INFORMACOES DO KIT</span>
              <h2>Confira todos os detalhes antes de reservar</h2>
              <p>Modelo, logos, patrocinador, acabamento e detalhes das camisas preto e branco.</p>
            </div>
          </div>
          <div className="kit-info-image-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="kit-info-image" src="/img/kit-full.webp" alt="Detalhes oficiais dos uniformes WAAW by Alok" />
          </div>
        </section>

        <div className="layout">
          <div className="panel">
            <div className="viewer">
              <div className="color-toggle">
                <button
                  type="button"
                  className={color === "preto" ? "active" : ""}
                  onClick={() => setColor("preto")}
                >
                  Preto
                </button>
                <button
                  type="button"
                  className={color === "branco" ? "active" : ""}
                  onClick={() => setColor("branco")}
                >
                  Branco
                </button>
              </div>
              <Viewer color={color} name={buyerName} number={firstItem.number} />
            </div>
          </div>

          <div className="panel">
            <form onSubmit={handleSubmit}>
              {error && <div className="status-msg error">{error}</div>}

              <div className="field">
                <label>Nome no uniforme</label>
                <input
                  type="text"
                  placeholder="Ex: MARCEL"
                  value={buyerName}
                  maxLength={30}
                  onChange={(e) => setBuyerName(e.target.value)}
                />
              </div>

              <div className="field">
                <label>Contato (whatsapp ou e-mail, opcional)</label>
                <input
                  type="text"
                  placeholder="Para avisarmos sobre a confirmacao"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                />
              </div>

              <label style={{ fontSize: 12, color: "#9a9aa2", marginBottom: 8, display: "block" }}>
                Kits (maximo 4, sendo no maximo 2 por cor)
              </label>

              {items.map((it, idx) => {
                const taken = isTaken(it.color, it.number);
                return (
                  <div className="kit-row" key={idx}>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Cor</label>
                      <select
                        value={it.color}
                        onChange={(e) => {
                          const newColor = e.target.value;
                          const others = items.filter((_, i) => i !== idx);
                          if (countByColor(others, newColor) >= MAX_PER_COLOR) {
                            setError(`Voce ja selecionou o maximo de ${MAX_PER_COLOR} kits na cor ${newColor}.`);
                            return;
                          }
                          setError("");
                          updateItem(idx, { color: newColor });
                          if (idx === 0) setColor(newColor);
                        }}
                      >
                        <option value="preto">Preto</option>
                        <option value="branco">Branco</option>
                      </select>
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Numero (0-100)</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        placeholder="10"
                        value={it.number}
                        onFocus={() => idx === 0 && setColor(it.color)}
                        onChange={(e) => {
                          let v = e.target.value;
                          if (v !== "") v = Math.max(0, Math.min(100, Number(v)));
                          updateItem(idx, { number: v });
                        }}
                        style={taken ? { borderColor: "#e0554f", color: "#ff8a84" } : {}}
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Tam. camisa</label>
                      <select
                        value={it.shirtSize}
                        onChange={(e) => updateItem(idx, { shirtSize: e.target.value })}
                      >
                        {SIZES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Tam. calcao</label>
                      <select
                        value={it.shortsSize}
                        onChange={(e) => updateItem(idx, { shortsSize: e.target.value })}
                      >
                        {SIZES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    {items.length > 1 && (
                      <button type="button" className="remove-btn" onClick={() => removeItem(idx)}>
                        Remover
                      </button>
                    )}
                    {taken && (
                      <div style={{ gridColumn: "1 / -1", fontSize: 12, color: "#ff8a84" }}>
                        Numero {it.number} ja atingiu o limite de {availability.maxUnitsPerNumber || 2} unidades
                        (pagas ou aguardando pagamento) nesta cor — escolha outro numero, ou tente
                        novamente mais tarde caso algum pagamento pendente expire.
                      </div>
                    )}
                  </div>
                );
              })}

              <button type="button" className="add-btn" onClick={addItem} disabled={items.length >= MAX_ITEMS}>
                + Adicionar outro kit (opcional, ate {MAX_ITEMS} no total)
              </button>

              <details>
                <summary style={{ cursor: "pointer", fontSize: 12, color: "#9a9aa2", marginBottom: 6 }}>
                  Ver numeros ja reservados ({color})
                </summary>
                <div className="number-grid">
                  {Array.from({ length: 101 }, (_, n) => n).map((n) => {
                    const entry = availability.taken?.[color]?.[n];
                    const count = entry?.count || 0;
                    const max = availability.maxUnitsPerNumber || 2;
                    let cls = "free";
                    let label = "disponivel";
                    if (count >= max) {
                      cls = entry?.hasPago ? "taken" : "pending";
                      label = entry?.hasPago ? "esgotado (pago)" : "esgotado (pendente)";
                    } else if (count > 0) {
                      cls = "pending";
                      label = `1 de ${max} vendido/reservado`;
                    }
                    return (
                      <div key={n} className={`number-chip ${cls}`} title={label}>
                        {n}
                      </div>
                    );
                  })}
                </div>
              </details>

              <div className="total-row">
                <span>Total</span>
                <span className="price">
                  {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
              </div>

              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? "Gerando reserva..." : "Reservar e gerar Pix"}
              </button>
            </form>
          </div>
        </div>

        <div className="footer-note">
          Kit = camisa + shorts · R$ {price.toFixed(2).replace(".", ",")} por kit · Numeracao de 0 a 100
          <br />
          Ao clicar em "Reservar" o numero fica <b>pendente</b> (reservado apenas para voce) por
          {" "}
          {pixData ? pixData.holdMinutes : 30} minutos enquanto voce paga o Pix. Se o pagamento nao for
          confirmado nesse prazo, o numero volta a ficar livre para qualquer pessoa. O numero so fica
          definitivamente garantido apos a confirmacao do pagamento.
        </div>
      </div>

      {pixData && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && null}>
          <div className="modal">
            <h2>Escaneie para pagar</h2>
            <p className="sub">Pix para {process.env.NEXT_PUBLIC_PIX_NAME || "MARCEL CRISTIAN AMBROSIO"}</p>
            {qrDataUrl && (
              <div className="qr-box">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt="QR Code Pix" width={230} height={230} />
              </div>
            )}
            <div className="amount">
              {Number(pixData.totalAmount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </div>
            {secondsLeft > 0 ? (
              <div className="timer">
                Reserva expira em {mm}:{ss}
              </div>
            ) : (
              <div className="timer" style={{ color: "#e0554f" }}>
                Tempo expirado — se ainda nao pagou, o numero pode ser liberado.
              </div>
            )}
            <div className="copy-box">{pixData.pixPayload}</div>
            <button type="button" className="btn-primary" onClick={copyPix} style={{ marginBottom: 10 }}>
              {copied ? "Copiado!" : "Copiar codigo Pix (copia e cola)"}
            </button>
            <div>
              <button type="button" className="close-btn" onClick={closeModal}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
