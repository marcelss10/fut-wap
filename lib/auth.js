import crypto from "crypto";
import cookie from "cookie";

const COOKIE_NAME = "kitstore_admin";

function getSecret() {
  return process.env.ADMIN_SESSION_SECRET || "dev-secret-troque-em-producao";
}

function sign(value) {
  const h = crypto.createHmac("sha256", getSecret()).update(value).digest("hex");
  return `${value}.${h}`;
}

function verify(signed) {
  if (!signed) return false;
  const idx = signed.lastIndexOf(".");
  if (idx === -1) return false;
  const value = signed.slice(0, idx);
  const sig = signed.slice(idx + 1);
  const expected = crypto.createHmac("sha256", getSecret()).update(value).digest("hex");
  try {
    return (
      value === "admin-ok" &&
      crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    );
  } catch {
    return false;
  }
}

function setAdminCookie(res) {
  const token = sign("admin-ok");
  res.setHeader(
    "Set-Cookie",
    cookie.serialize(COOKIE_NAME, token, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 8, // 8 horas
    })
  );
}

function clearAdminCookie(res) {
  res.setHeader(
    "Set-Cookie",
    cookie.serialize(COOKIE_NAME, "", {
      httpOnly: true,
      path: "/",
      maxAge: 0,
    })
  );
}

function isAdminRequest(req) {
  const cookies = cookie.parse(req.headers.cookie || "");
  return verify(cookies[COOKIE_NAME]);
}

export { setAdminCookie, clearAdminCookie, isAdminRequest, COOKIE_NAME };
