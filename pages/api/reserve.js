import crypto from "crypto";
import { getAll, isActive, reserveKits, MAX_UNITS_PER_NUMBER } from "../../lib/db";
import { buildPixPayload } from "../../lib/pix";

const PRICE = Number(process.env.KIT_PRICE || 49.9);
const MAX_ITEMS_PER_PERSON = 4;
const MAX_ITEMS_PER_COLOR = 2;
const VALID_SIZES = ["PP", "P", "M", "G", "GG", "XG"];

function sanitizeName(name) {
  return String(name || "").trim().slice(0, 30);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Metodo nao permitido" });
  }

  try {
    const { buyerName, contact, items } = req.body || {};
    const nameSan = sanitizeName(buyerName);

    if (!nameSan) {
      return res.status(400).json({ error: "Informe o nome que ira no uniforme." });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Selecione pelo menos 1 kit (numero + cor)." });
    }
    if (items.length > MAX_ITEMS_PER_PERSON) {
      return res.status(400).json({ error: `Maximo de ${MAX_ITEMS_PER_PERSON} numeros por pessoa.` });
    }

    const normalizedItems = items.map((it) => ({
      number: Number(it.number),
      color: it.color,
      shirtSize: String(it.shirtSize || "").toUpperCase().trim(),
      shortsSize: String(it.shortsSize || "").toUpperCase().trim(),
    }));

    for (const it of normalizedItems) {
      if (!Number.isInteger(it.number) || it.number < 0 || it.number > 100) {
        return res.status(400).json({ error: "Numero invalido. Use valores de 0 a 100." });
      }
      if (it.color !== "preto" && it.color !== "branco") {
        return res.status(400).json({ error: "Cor invalida." });
      }
      if (!VALID_SIZES.includes(it.shirtSize)) {
        return res.status(400).json({ error: "Escolha o tamanho da camisa (PP, P, M, G, GG ou XG)." });
      }
      if (!VALID_SIZES.includes(it.shortsSize)) {
        return res.status(400).json({ error: "Escolha o tamanho do calcao (PP, P, M, G, GG ou XG)." });
      }
    }

    const perColorCount = { preto: 0, branco: 0 };
    for (const it of normalizedItems) perColorCount[it.color] += 1;
    if (perColorCount.preto > MAX_ITEMS_PER_COLOR || perColorCount.branco > MAX_ITEMS_PER_COLOR) {
      return res.status(400).json({ error: `Maximo de ${MAX_ITEMS_PER_COLOR} numeros por cor.` });
    }

    // Consulta rapida para dar uma mensagem amigavel antes da tentativa atomica.
    const all = await getAll();
    const countsInOrder = {};
    for (const it of normalizedItems) {
      const key = `${it.color}-${it.number}`;
      countsInOrder[key] = (countsInOrder[key] || 0) + 1;
      const existingActive = all.filter(
        (r) => r.color === it.color && r.number === it.number && isActive(r)
      ).length;
      if (existingActive + countsInOrder[key] > MAX_UNITS_PER_NUMBER) {
        return res.status(409).json({
          error: `O numero ${it.number} (${it.color}) ja atingiu o limite de ${MAX_UNITS_PER_NUMBER} unidades vendidas/reservadas.`,
          conflict: { number: it.number, color: it.color },
        });
      }
    }

    const groupId = crypto.randomUUID();
    const txid = groupId.replace(/-/g, "").slice(0, 25).toUpperCase();
    const totalAmount = Number((PRICE * normalizedItems.length).toFixed(2));

    // No Supabase esta chamada e atomica: os numeros sao reservados juntos.
    const newReservations = await reserveKits({
      name: nameSan.toUpperCase(),
      contact: String(contact || "").trim().slice(0, 60),
      items: normalizedItems,
      amount: PRICE,
      txid,
      groupId,
    });

    const payload = buildPixPayload({
      pixKey: process.env.PIX_KEY || "+5541995773260",
      receiverName: process.env.PIX_RECEIVER_NAME || "MARCEL CRISTIAN AMBROSIO",
      receiverCity: process.env.PIX_RECEIVER_CITY || "SAO PAULO",
      amount: totalAmount,
      txid: groupId,
      description: "KIT UNIFORME",
    });

    return res.status(200).json({
      ok: true,
      groupId,
      reservationIds: newReservations.map((r) => r.id),
      totalAmount,
      pixPayload: payload,
      items: newReservations,
      holdMinutes: 30,
    });
  } catch (err) {
    console.error(err);
    if (err?.code === "NUMBER_TAKEN" || String(err?.message || "").includes("NUMBER_TAKEN")) {
      return res.status(409).json({ error: "Um dos numeros acabou de ser reservado por outra pessoa. Atualize a pagina e escolha outro." });
    }
    return res.status(500).json({ error: "Erro interno ao criar reserva." });
  }
}
