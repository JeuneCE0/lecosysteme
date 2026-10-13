// Outils partagés par les fonctions Cut (le « _ » empêche Vercel d'en faire une route).
const crypto = require("crypto");

const GHL = "https://services.leadconnectorhq.com";
const GHL_LOCATION = "NsV7HI2MbE6qHtRp410y";
const RESEND = "https://api.resend.com";
const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

function lireCorps(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body || "{}"); } catch { return Object.fromEntries(new URLSearchParams(req.body)); }
  }
  return {};
}

function texte(v, max) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

async function appel(base, chemin, methode, jeton, corps, entetes = {}) {
  const r = await fetch(base + chemin, {
    method: methode,
    headers: { Authorization: `Bearer ${jeton}`, "Content-Type": "application/json", ...entetes },
    body: corps === undefined ? undefined : JSON.stringify(corps),
    signal: AbortSignal.timeout(8000),
  });
  const json = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, json };
}

const ghl = (chemin, corps) => appel(GHL, chemin, "POST", process.env.GHL_PIT_TOKEN, corps, { Version: "2021-07-28" });
const resend = (chemin, methode, corps, entetes) => appel(RESEND, chemin, methode, process.env.RESEND_API_KEY, corps, entetes);
const resendPret = () => Boolean(process.env.RESEND_API_KEY && process.env.RESEND_AUDIENCE_CUT && process.env.RESEND_FROM_CUT);

// L'upsert ne reçoit pas de tags : ils sont ajoutés ensuite, pour ne pas écraser ceux d'un autre parcours (BOUSSOLE…).
async function contactGHL(champs, tags = [], note = "") {
  const r = await ghl("/contacts/upsert", { locationId: GHL_LOCATION, source: "Cut — liste d'attente", ...champs });
  const contact = r.json?.contact;
  if (!r.ok || !contact?.id) throw new Error(`GHL upsert ${r.status}`);
  const suites = [];
  if (tags.length) suites.push(ghl(`/contacts/${contact.id}/tags`, { tags }));
  if (note) suites.push(ghl(`/contacts/${contact.id}/notes`, { body: note }));
  await Promise.all(suites);
  return contact;
}

// Lien de désinscription signé : personne ne peut désinscrire l'adresse d'un autre.
function signature(email) {
  const secret = process.env.CUT_LIEN_SECRET || process.env.RESEND_API_KEY || "";
  return crypto.createHmac("sha256", secret).update(email).digest("hex").slice(0, 32);
}
function signatureValide(email, sig) {
  if (!process.env.CUT_LIEN_SECRET && !process.env.RESEND_API_KEY) return false;
  const attendu = Buffer.from(signature(email));
  const recu = Buffer.from(String(sig || ""));
  return attendu.length === recu.length && crypto.timingSafeEqual(attendu, recu);
}
function lienDesinscription(origine, email) {
  return `${origine}/api/cut/desinscription?e=${encodeURIComponent(email)}&s=${signature(email)}`;
}

module.exports = { EMAIL, lireCorps, texte, ghl, resend, resendPret, contactGHL, signatureValide, lienDesinscription };
