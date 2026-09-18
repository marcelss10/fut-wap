import { setAdminCookie } from "../../../lib/auth";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Metodo nao permitido" });
  }

  const { user, pass } = req.body || {};
  const ADMIN_USER = process.env.ADMIN_USER || "aidmin";
  const ADMIN_PASS = process.env.ADMIN_PASS || "12346";

  if (user === ADMIN_USER && pass === ADMIN_PASS) {
    setAdminCookie(res);
    return res.status(200).json({ ok: true });
  }

  return res.status(401).json({ error: "Usuario ou senha invalidos." });
};
