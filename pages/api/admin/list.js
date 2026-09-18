import { getAll, isActive, usingSupabase } from "../../../lib/db";
import { isAdminRequest } from "../../../lib/auth";

export default async function handler(req, res) {
  if (!isAdminRequest(req)) {
    return res.status(401).json({ error: "Nao autorizado." });
  }
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Metodo nao permitido" });
  }

  const all = await getAll();
  const sorted = [...all].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const withActive = sorted.map((r) => ({ ...r, active: isActive(r) }));

  const summary = {
    total: all.length,
    pagos: all.filter((r) => r.status === "pago").length,
    pendentes: all.filter((r) => r.status === "pendente" && isActive(r)).length,
    rejeitados: all.filter((r) => r.status === "rejeitado").length,
    faturamentoConfirmado: all
      .filter((r) => r.status === "pago")
      .reduce((s, r) => s + Number(r.amount || 0), 0),
    usingSupabase,
  };

  return res.status(200).json({ reservations: withActive, summary });
};
