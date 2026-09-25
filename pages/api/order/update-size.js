import { findById, updateReservation } from "../../../lib/db";

const VALID_SIZES = ["PP", "P", "M", "G", "GG", "XG", "G3"];

// Endpoint publico usado pelo botao "Editar Pedido": permite que a pessoa
// troque o tamanho da camisa/calcao do proprio pedido ja criado. So altera
// shirt_size/shorts_size + updated_at, nunca numero, nome, valor ou status.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Metodo nao permitido" });
  }

  try {
    const { id, shirtSize, shortsSize } = req.body || {};
    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "Pedido invalido." });
    }

    const shirt = String(shirtSize || "").toUpperCase().trim();
    const shorts = String(shortsSize || "").toUpperCase().trim();
    if (!VALID_SIZES.includes(shirt) || !VALID_SIZES.includes(shorts)) {
      return res.status(400).json({ error: "Escolha um tamanho valido (PP, P, M, G, GG, XG ou G3)." });
    }

    const existing = await findById(id);
    if (!existing) {
      return res.status(404).json({ error: "Pedido nao encontrado." });
    }
    if (existing.status === "cancelado" || existing.status === "rejeitado") {
      return res.status(409).json({ error: "Este pedido esta cancelado e nao pode mais ser editado." });
    }

    const updated = await updateReservation(id, {
      shirtSize: shirt,
      shortsSize: shorts,
      updatedAt: new Date().toISOString(),
    });

    if (!updated) {
      return res.status(404).json({ error: "Pedido nao encontrado." });
    }

    return res.status(200).json({
      ok: true,
      id,
      shirtSize: shirt,
      shortsSize: shorts,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao atualizar o pedido." });
  }
}
