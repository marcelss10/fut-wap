// Gerador de payload Pix (BR Code / EMV) dinâmico, com valor e identificador
// de transação (txid) variáveis, e cálculo correto do CRC16-CCITT (campo 63).

function tlv(id, value) {
  const len = String(value.length).padStart(2, "0");
  return `${id}${len}${value}`;
}

function sanitize(str, maxLen) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .toUpperCase()
    .trim()
    .slice(0, maxLen);
}

function crc16ccitt(payload) {
  let crc = 0xffff;
  const polynomial = 0x1021;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ polynomial) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Monta o payload Pix "copia e cola" dinâmico.
 * @param {Object} opts
 * @param {string} opts.pixKey - chave pix (telefone, email, cpf, aleatória...)
 * @param {string} opts.receiverName - nome do recebedor (max 25 chars)
 * @param {string} opts.receiverCity - cidade do recebedor (max 15 chars)
 * @param {number} opts.amount - valor em reais, ex: 89.90
 * @param {string} opts.txid - identificador da transação (alfanumérico, max 25 chars)
 * @param {string} [opts.description] - mensagem opcional
 */
function buildPixPayload({ pixKey, receiverName, receiverCity, amount, txid, description }) {
  const gui = tlv("00", "br.gov.bcb.pix");
  const key = tlv("01", pixKey);
  const desc = description ? tlv("02", sanitize(description, 40)) : "";
  const merchantAccountInfo = tlv("26", gui + key + desc);

  const merchantCategoryCode = tlv("52", "0000");
  const transactionCurrency = tlv("53", "986"); // BRL
  const transactionAmount = tlv("54", amount.toFixed(2));
  const countryCode = tlv("58", "BR");
  const merchantName = tlv("59", sanitize(receiverName, 25) || "RECEBEDOR");
  const merchantCity = tlv("60", sanitize(receiverCity, 15) || "BRASIL");

  const cleanTxid = (txid || "***").replace(/[^a-zA-Z0-9]/g, "").slice(0, 25) || "***";
  const additionalData = tlv("62", tlv("05", cleanTxid));

  const payloadFormat = tlv("00", "01");

  let payload =
    payloadFormat +
    merchantAccountInfo +
    merchantCategoryCode +
    transactionCurrency +
    transactionAmount +
    countryCode +
    merchantName +
    merchantCity +
    additionalData +
    "6304"; // CRC id + length, valor calculado a seguir

  const crc = crc16ccitt(payload);
  payload += crc;
  return payload;
}

export { buildPixPayload, crc16ccitt };
