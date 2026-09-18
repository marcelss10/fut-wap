import { getAll, updateReservation } from "../../../lib/db";
import { isAdminRequest } from "../../../lib/auth";

const VALID = ["pago", "pendente", "rejeitado", "cancelado"];

export default async function handler(req, res) {
  if (!isAdminRequest(req)) return res.status(401).json({ error: "Nao autorizado." });
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Metodo nao permitido" });
  }

  const { id, status } = req.body || {};
  if (!id || !VALID.includes(status)) {
    return res.status(400).json({ error: "Parametros invalidos." });
  }

  try {
    const all = await getAll();
    const current = all.find((r) => r.id === id);
    if (!current) return res.status(404).json({ error: "Reserva nao encontrada." });

    const updated = await updateReservation(id, {
      status,
      updatedAt: new Date().toISOString(),
      obs: status === "pago" ? "Pagamento confirmado pelo admin." : current.obs,
    });
    return res.status(200).json({ ok: true, reservation: updated });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao atualizar o status." });
  }
}
