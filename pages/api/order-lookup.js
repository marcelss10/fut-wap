import { getAll, usingSupabase } from "../../lib/db";

// Nomes de pedidos "seed" antigos (sem tamanho, sem valor cobrado) que nao
// devem aparecer na busca nem na listagem de auto-atendimento.
const EXCLUDED_NAMES = ["MARCEL", "JOSE TELLES", "FELIPE BARBOSA", "CICERO", "PAULO"];

// Apenas pedidos ativos (pagos ou aguardando pagamento) podem ter o tamanho
// alterado pelo proprio cliente.
const EDITABLE_STATUS = ["pago", "pendente"];

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

function toClient(r) {
  return {
    id: r.id,
    name: r.name,
    number: r.number,
    color: r.color,
    status: r.status,
    shirtSize: r.shirtSize || "",
    shortsSize: r.shortsSize || "",
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Metodo nao permitido" });
  }

  try {
    const all = await getAll();
    const eligible = all.filter(
      (r) => EDITABLE_STATUS.includes(r.status) && !isExcluded(r.name)
    );

    if (req.query.all === "1") {
      const seen = new Set();
      const names = [];
      for (const r of eligible) {
        const key = normalize(r.name);
        if (seen.has(key)) continue;
        seen.add(key);
        names.push(r.name);
      }
      names.sort((a, b) => a.localeCompare(b, "pt-BR"));
      // "source" ajuda a diagnosticar: se vier "local" em producao, as
      // variaveis SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY nao estao
      // configuradas no ambiente de hospedagem e o app esta usando o
      // arquivo local (que so tem os pedidos seed, todos excluidos).
      return res.status(200).json({ names, source: usingSupabase ? "supabase" : "local" });
    }

    const query = normalize(req.query.name);
    if (!query) {
      return res.status(400).json({ error: "Informe um nome para buscar." });
    }

    const matches = eligible
      .filter((r) => normalize(r.name).includes(query))
      .map(toClient);

    return res.status(200).json({ matches, source: usingSupabase ? "supabase" : "local" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao consultar pedidos." });
  }
}
