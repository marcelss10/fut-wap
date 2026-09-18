import { getAll, isActive, cleanupExpired } from "../../lib/db";

const MAX_UNITS_PER_NUMBER = 2;

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Metodo nao permitido" });
  }

  try {
    await cleanupExpired();
    const all = await getAll();
    const taken = { preto: {}, branco: {} };

    for (const r of all) {
      if (!isActive(r)) continue;
      if (!taken[r.color]) continue;
      if (!taken[r.color][r.number]) {
        taken[r.color][r.number] = { count: 0, hasPago: false, hasPendente: false };
      }
      taken[r.color][r.number].count += 1;
      if (r.status === "pago") taken[r.color][r.number].hasPago = true;
      if (r.status === "pendente") taken[r.color][r.number].hasPendente = true;
    }

    return res.status(200).json({
      taken,
      min: 0,
      max: 100,
      maxUnitsPerNumber: MAX_UNITS_PER_NUMBER,
      price: Number(process.env.KIT_PRICE || 89.9),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Nao foi possivel consultar a disponibilidade." });
  }
}
