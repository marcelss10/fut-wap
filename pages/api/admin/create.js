import crypto from "crypto";
import { getAll, isActive, createReservation } from "../../../lib/db";
import { isAdminRequest } from "../../../lib/auth";

export default async function handler(req, res) {
  if (!isAdminRequest(req)) return res.status(401).json({ error: "Nao autorizado." });
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Metodo nao permitido" });
  }

  const { name, number, color, status, amount, obs } = req.body || {};
  const num = Number(number);
  const finalStatus = status && ["pago", "pendente", "rejeitado", "cancelado"].includes(status) ? status : "pago";

  if (!name || !Number.isInteger(num) || num < 0 || num > 100) {
    return res.status(400).json({ error: "Dados invalidos." });
  }
  if (color !== "preto" && color !== "branco") {
    return res.status(400).json({ error: "Cor invalida." });
  }

  try {
    const all = await getAll();
    const conflict = all.find((r) => r.color === color && r.number === num && isActive(r));
    if (conflict) {
      return res.status(409).json({ error: `Numero ${num} (${color}) ja esta ocupado por ${conflict.name}.` });
    }

    const now = new Date();
    const record = {
      id: crypto.randomUUID(),
      name: String(name).trim().toUpperCase().slice(0, 30),
      number: num,
      color,
      status: finalStatus,
      amount: Number(amount) || Number(process.env.KIT_PRICE || 89.9),
      txid: "ADMIN" + crypto.randomUUID().replace(/-/g, "").slice(0, 15).toUpperCase(),
      createdAt: now.toISOString(),
      expiresAt: finalStatus === "pendente" ? new Date(now.getTime() + 30 * 60 * 1000).toISOString() : null,
      obs: obs || "Criado manualmente pelo admin",
    };

    const saved = await createReservation(record);
    return res.status(200).json({ ok: true, reservation: saved });
  } catch (err) {
    console.error(err);
    if (err?.code === "23505" || String(err?.message || "").includes("reservations_active_number_unique")) {
      return res.status(409).json({ error: `Numero ${num} (${color}) acabou de ser ocupado.` });
    }
    return res.status(500).json({ error: "Erro ao criar reserva." });
  }
}
