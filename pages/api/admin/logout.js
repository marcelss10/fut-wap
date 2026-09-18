import { clearAdminCookie } from "../../../lib/auth";

export default async function handler(req, res) {
  clearAdminCookie(res);
  return res.status(200).json({ ok: true });
};
