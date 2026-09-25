import { getAll, updateReservation } from "../../lib/db";

const VALID_SIZES = ["PP", "P", "M", "G", "GG", "XG"];
const EDITABLE_STATUS = ["pago", "pendente"];
const EXCLUDED_NAMES = ["MARCEL", "JOSE TELLES", "FELIPE BARBOSA", "CICERO", "PAULO"];

function normalize(str) {
  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function isExcluded(name) {
  const n = normalize(name);
  return EXCLUDED_NAMES.some((ex) => normalize(ex) === n);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Metodo nao permitido" });
  }

  const { id, shirtSize, shortsSize } = req.body || {};
  const shirt = String(shirtSize || "").toUpperCase().trim();
  const shorts = String(shortsSize || "").toUpperCase().trim();

  if (!id) {
    return res.status(400).json({ error: "Pedido nao informado." });
  }
  if (!VALID_SIZES.includes(shirt) || !VALID_SIZES.includes(shorts)) {
    return res.status(400).json({ error: "Escolha um tamanho valido (PP, P, M, G, GG ou XG)." });
  }

  try {
    const all = await getAll();
    const current = all.find((r) => r.id === id);
    if (!current) {
      return res.status(404).json({ error: "Pedido nao encontrado." });
    }
    if (isExcluded(current.name)) {
      return res.status(403).json({ error: "Este pedido nao pode ser alterado por aqui." });
    }
    if (!EDITABLE_STATUS.includes(current.status)) {
      return res.status(400).json({ error: "Este pedido nao esta ativo e nao pode ter o tamanho alterado." });
    }

    const updated = await updateReservation(id, {
      shirtSize: shirt,
      shortsSize: shorts,
      updatedAt: new Date().toISOString(),
    });

    return res.status(200).json({ ok: true, reservation: updated });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao atualizar o tamanho." });
  }
}
