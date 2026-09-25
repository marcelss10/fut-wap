import { searchReservations } from "../../../lib/db";

// Endpoint publico e somente-leitura: usado pelo botao "Editar Pedido" para
// listar/buscar pedidos ja feitos (por nome), sem expor contato/telefone.
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Metodo nao permitido" });
  }

  try {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const results = await searchReservations(q);

    const safe = results.map((r) => ({
      id: r.id,
      groupId: r.groupId,
      name: r.name,
      number: r.number,
      color: r.color,
      status: r.status,
      shirtSize: r.shirtSize || "",
      shortsSize: r.shortsSize || "",
      createdAt: r.createdAt,
    }));

    return res.status(200).json({ ok: true, results: safe });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao buscar pedidos." });
  }
}
