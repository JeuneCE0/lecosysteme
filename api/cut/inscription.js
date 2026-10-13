// Liste d'attente Cut : la page n'appelle que cette fonction, les clés restent côté serveur.
// 1. GHL (CRM) : contact, tags CUT / CUT-LISTE-ATTENTE, puis durée de montage, accord d'affichage, réponse en note.
// 2. Resend (e-mails) : contact dans l'audience Cut, bienvenue à la première inscription.
// Variables Vercel : GHL_PIT_TOKEN (obligatoire), RESEND_API_KEY, RESEND_AUDIENCE_CUT, RESEND_FROM_CUT (« Cut <cut@domaine> »).

const GHL = "https://services.leadconnectorhq.com";
const GHL_LOCATION = "NsV7HI2MbE6qHtRp410y";
const RESEND = "https://api.resend.com";
const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const DUREES = { "Moins d'1 h": "MOINS-1H", "1 à 3 h": "1-3H", "3 à 6 h": "3-6H", "Plus de 6 h": "PLUS-6H" };

function lireCorps(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try { return JSON.parse(req.body || "{}"); } catch { return {}; }
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
const resend = (chemin, methode, corps) => appel(RESEND, chemin, methode, process.env.RESEND_API_KEY, corps);

// L'upsert ne reçoit pas de tags : ils sont ajoutés ensuite, pour ne pas écraser ceux d'un autre parcours (BOUSSOLE…).
async function contactGHL(champs, tags, note) {
  const r = await ghl("/contacts/upsert", { locationId: GHL_LOCATION, source: "Cut — liste d'attente", ...champs });
  const id = r.json?.contact?.id;
  if (!r.ok || !id) throw new Error(`GHL upsert ${r.status}`);
  const suites = [];
  if (tags.length) suites.push(ghl(`/contacts/${id}/tags`, { tags }));
  if (note) suites.push(ghl(`/contacts/${id}/notes`, { body: note }));
  await Promise.all(suites);
  return id;
}

function bienvenue() {
  const text = [
    "Salut,",
    "",
    "C'est noté : tu es sur la liste d'attente de Cut.",
    "",
    "Cut monte tes reels à ta place, en quelques clics avec Claude : coupes, sous-titres, animations, son. Tu tournes, tu valides.",
    "",
    "Tu seras prévenu avant tout le monde à l'ouverture. D'ici là, on t'envoie quelques e-mails pour te montrer Cut en action.",
    "",
    "À très vite,",
    "L'équipe de L'Écosystème",
  ].join("\n");
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#efefef;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#16130c">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border-radius:18px;padding:32px">
<tr><td style="font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:#6b6459;font-family:Menlo,Consolas,monospace">Liste d'attente · Cut</td></tr>
<tr><td style="padding-top:16px;font-size:26px;line-height:1.2;font-weight:600;letter-spacing:-.02em">Tu es sur la liste<span style="color:#c2370a">.</span></td></tr>
<tr><td style="padding-top:16px;font-size:16px;line-height:1.55;color:#4a443a">Salut,<br><br>Cut monte tes reels à ta place, en quelques clics avec Claude&nbsp;: coupes, sous-titres, animations, son. Tu tournes, tu valides.<br><br>Tu seras prévenu avant tout le monde à l'ouverture. D'ici là, on t'envoie quelques e-mails pour te montrer Cut en action.</td></tr>
<tr><td style="padding-top:24px;font-size:16px;line-height:1.55;color:#16130c">À très vite,<br>L'équipe de L'Écosystème</td></tr>
</table>
<p style="max-width:520px;margin:16px auto 0;font-size:12px;line-height:1.5;color:#6b6459">Tu reçois cet e-mail parce que tu t'es inscrit sur go.lecosysteme.com/cut.</p>
</td></tr></table></body></html>`;
  return { text, html };
}

// Resend ne bloque jamais l'inscription : GHL fait foi, l'audience peut être resynchronisée depuis les tags CUT.
async function syncResend(etape, email, prenom) {
  const audience = process.env.RESEND_AUDIENCE_CUT;
  if (!process.env.RESEND_API_KEY || !audience) return "non configuré";
  const chemin = `/audiences/${audience}/contacts/${encodeURIComponent(email)}`;
  if (etape === "reponse") {
    if (prenom) await resend(chemin, "PATCH", { first_name: prenom });
    return "ok";
  }
  const deja = await resend(chemin, "GET");
  if (deja.ok) return "déjà inscrit";
  const cree = await resend(`/audiences/${audience}/contacts`, "POST", { email, unsubscribed: false });
  if (cree.ok && process.env.RESEND_FROM_CUT) {
    await resend("/emails", "POST", { from: process.env.RESEND_FROM_CUT, to: [email], subject: "Tu es sur la liste de Cut", ...bienvenue() });
  }
  return cree.ok ? "ok" : `erreur ${cree.status}`;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false });
  }
  const corps = lireCorps(req);
  if (texte(corps.site, 200)) return res.status(200).json({ ok: true });
  const email = texte(corps.email, 254).toLowerCase();
  if (!EMAIL.test(email)) return res.status(400).json({ ok: false, erreur: "email" });
  if (!process.env.GHL_PIT_TOKEN) {
    console.error("cut/inscription : GHL_PIT_TOKEN absent, inscription refusée");
    return res.status(503).json({ ok: false, erreur: "configuration" });
  }

  const etape = corps.etape === "reponse" ? "reponse" : "liste";
  const prenom = texte(corps.prenom, 40);
  try {
    if (etape === "liste") {
      await contactGHL({ email }, ["CUT", "CUT-LISTE-ATTENTE"]);
    } else {
      const duree = Object.hasOwn(DUREES, corps.duree) ? corps.duree : null;
      if (!duree) return res.status(400).json({ ok: false, erreur: "duree" });
      const accord = corps.accord === true;
      const frustration = texte(corps.frustration, 400);
      const tags = [`CUT-MONTAGE-${DUREES[duree]}`];
      if (accord && prenom) tags.push("CUT-AVIS-AFFICHABLE");
      const note = [
        "Cut — réponse liste d'attente",
        `Montage d'une vidéo : ${duree}`,
        `Ce qui le saoule : ${frustration || "—"}`,
        `Affichage sur la page : ${accord && prenom ? "oui, prénom seul" : "non"}`,
      ].join("\n");
      await contactGHL(prenom ? { email, firstName: prenom } : { email }, tags, note);
    }
  } catch (e) {
    console.error("cut/inscription GHL", e);
    return res.status(502).json({ ok: false });
  }

  let mail = "non tenté";
  try {
    mail = await syncResend(etape, email, prenom);
  } catch (e) {
    console.error("cut/inscription Resend", e);
    mail = "erreur";
  }
  return res.status(200).json({ ok: true, mail });
};
