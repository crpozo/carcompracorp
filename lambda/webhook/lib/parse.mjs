// Construccion del objeto "lead" a partir del payload de WhatsApp.

/**
 * Convierte el objeto referral (anuncio Click-to-WhatsApp) a un string legible.
 * Preferencia: headline > source_id > body > null.
 */
function referralToString(referral) {
  if (!referral) return null;
  return referral.headline || referral.source_id || referral.body || null;
}

/**
 * Construye un lead a partir del "value" del webhook y un mensaje individual.
 * @param {object} value  value = body.entry[0].changes[0].value
 * @param {object} msg    un elemento de value.messages
 * @param {string} [nowIso] ISO string de respaldo si el mensaje no trae timestamp
 * @returns {object} lead listo para persistir
 */
export function buildLead(value, msg, nowIso) {
  // creadoEn: derivar del timestamp del mensaje (segundos). Si no viene,
  // usar el nowIso pasado por el caller. Nunca llamamos Date.now() implicito.
  const creadoEn = msg.timestamp
    ? new Date(Number(msg.timestamp) * 1000).toISOString()
    : nowIso;

  // mensaje: texto plano si es 'text', si no intentar msg[type].body.
  const mensaje = msg.text?.body || msg[msg.type]?.body || '';

  return {
    leadId: msg.id, // wamid, sirve de clave de dedupe
    nombre: value.contacts?.[0]?.profile?.name || 'Sin nombre',
    telefono: msg.from,
    mensaje,
    anuncioOrigen: referralToString(msg.referral),
    canal: 'whatsapp',
    estado: 'nuevo',
    creadoEn,
  };
}
