import crypto from "crypto";
import fs from "fs";
import path from "path";

const DATA_FILE = path.join(process.cwd(), "data", "reservations.json");
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PENDING_HOLD_MS = 30 * 60 * 1000;
export const MAX_UNITS_PER_NUMBER = 2;

export const usingSupabase = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
export const usingRedis = false;

function supabaseHeaders(extra = {}) {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

function supabaseBase() {
  if (!usingSupabase) throw new Error("Supabase nao configurado.");
  return `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1`;
}

async function supabaseRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: supabaseHeaders(options.headers || {}),
    cache: "no-store",
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) {
    const message = body?.message || body?.hint || body?.details || body?.error_description || text || "Erro no Supabase";
    const err = new Error(message);
    err.status = response.status;
    err.code = body?.code;
    err.details = body?.details;
    throw err;
  }
  return body;
}

function fileRead() {
  if (!fs.existsSync(DATA_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8")); } catch { return []; }
}

function fileWrite(list) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), "utf-8");
}

function fromRow(r) {
  return {
    id: r.id,
    groupId: r.group_id,
    name: r.name,
    contact: r.contact || "",
    number: r.number,
    color: r.color,
    status: r.status,
    amount: Number(r.amount || 0),
    txid: r.txid || "",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    expiresAt: r.expires_at,
    obs: r.obs || "",
    shirtSize: r.shirt_size || "",
    shortsSize: r.shorts_size || "",
  };
}

export function isActive(reservation) {
  if (reservation.status === "pago") return true;
  if (reservation.status === "pendente") {
    const expires = reservation.expiresAt
      ? new Date(reservation.expiresAt).getTime()
      : new Date(reservation.createdAt).getTime() + PENDING_HOLD_MS;
    return Date.now() < expires;
  }
  return false;
}

export async function getAll() {
  if (!usingSupabase) return fileRead();
  const rows = await supabaseRequest(
    `${supabaseBase()}/reservations?select=*&order=created_at.desc`,
    { headers: { Accept: "application/json" } }
  );
  return (rows || []).map(fromRow);
}

export async function saveAll(list) {
  // Compatibilidade com o modo local e scripts antigos. Em producao, prefira
  // as operacoes atomicas abaixo, que usam o banco diretamente.
  if (usingSupabase) {
    throw new Error("saveAll nao deve ser usado com Supabase; use updateReservation/createReservation.");
  }
  fileWrite(list);
}

export async function createReservation(record) {
  if (!usingSupabase) {
    const all = fileRead();
    fileWrite([...all, record]);
    return record;
  }
  const row = await supabaseRequest(`${supabaseBase()}/reservations`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      id: record.id,
      group_id: record.groupId || null,
      name: record.name,
      contact: record.contact || null,
      number: record.number,
      color: record.color,
      status: record.status,
      amount: record.amount,
      txid: record.txid || null,
      created_at: record.createdAt || new Date().toISOString(),
      updated_at: record.updatedAt || null,
      expires_at: record.expiresAt || null,
      obs: record.obs || null,
      shirt_size: record.shirtSize || null,
      shorts_size: record.shortsSize || null,
    }),
  });
  return fromRow(row[0]);
}

export async function updateReservation(id, patch) {
  if (!usingSupabase) {
    const all = fileRead();
    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...patch };
    fileWrite(all);
    return all[idx];
  }
  const dbPatch = {};
  if (patch.status !== undefined) dbPatch.status = patch.status;
  if (patch.updatedAt !== undefined) dbPatch.updated_at = patch.updatedAt;
  if (patch.obs !== undefined) dbPatch.obs = patch.obs;
  const rows = await supabaseRequest(`${supabaseBase()}/reservations?id=eq.${encodeURIComponent(id)}&select=*`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(dbPatch),
  });
  return rows?.[0] ? fromRow(rows[0]) : null;
}

export async function reserveKits({ name, contact, items, amount, txid, groupId }) {
  if (!usingSupabase) {
    const all = fileRead();
    const counts = {};
    for (const item of items) {
      const key = `${item.color}-${item.number}`;
      const existing = all.filter((r) => r.color === item.color && r.number === item.number && isActive(r)).length;
      counts[key] = (counts[key] || 0) + 1;
      if (existing + counts[key] > MAX_UNITS_PER_NUMBER) {
        const err = new Error(`NUMBER_TAKEN:${item.color}:${item.number}`);
        err.code = "NUMBER_TAKEN";
        throw err;
      }
    }
    const now = new Date().toISOString();
    const records = items.map((item) => ({
      id: crypto.randomUUID(),
      groupId,
      name,
      contact: contact || "",
      number: item.number,
      color: item.color,
      status: "pendente",
      amount,
      txid,
      createdAt: now,
      expiresAt: new Date(Date.now() + PENDING_HOLD_MS).toISOString(),
      shirtSize: item.shirtSize || "",
      shortsSize: item.shortsSize || "",
    }));
    fileWrite([...all, ...records]);
    return records;
  }

  const rows = await supabaseRequest(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/rpc/reserve_kits`, {
    method: "POST",
    body: JSON.stringify({
      p_name: name,
      p_contact: contact || null,
      p_items: items,
      p_amount: amount,
      p_txid: txid,
      p_group_id: groupId,
    }),
  });
  return (rows || []).map(fromRow);
}

export async function cleanupExpired() {
  if (!usingSupabase) return;
  await supabaseRequest(`${supabaseBase()}/rpc/expire_pending_reservations`, { method: "POST" });
}

export { PENDING_HOLD_MS };
