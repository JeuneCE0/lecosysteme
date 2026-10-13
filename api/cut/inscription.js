// Liste d'attente Cut : la page n'appelle que cette fonction, les clés restent côté serveur.
// Étapes : « liste » (e-mail), « reponse » (questionnaire), « relance » (questionnaire fermé sans réponse → mail 2 le lendemain).
// GHL fait foi (tags du brief d'Anthony : waitlist-cutai, sondage-ok) ; Resend envoie les mails et ne bloque jamais l'inscription.
// Variables Vercel : GHL_PIT_TOKEN (obligatoire), RESEND_API_KEY, RESEND_AUDIENCE_CUT, RESEND_FROM_CUT, RESEND_REPLY_TO_CUT, CUT_LIEN_SECRET.

const { EMAIL, lireCorps, texte, resend, resendPret, contactGHL, lienDesinscription } = require("./_commun");
const { mail1, mail2, lendemainDixHeures } = require("./_mails");

const DUREES = { "Moins d'1 h": "moins-1h", "1 à 3 h": "1-3h", "Plus de 3 h": "plus-3h", "Je préfère ne pas compter": "ne-compte-pas" };

function envoi(email, contenu, { idempotence, ...extra }, origine) {
  const desinscription = lienDesinscription(origine, email);
  return resend("/emails", "POST", {
    from: process.env.RESEND_FROM_CUT,
    to: [email],
    reply_to: process.env.RESEND_REPLY_TO_CUT || undefined,
    headers: { "List-Unsubscribe": `<${desinscription}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    ...contenu,
    ...extra,
  }, { "Idempotency-Key": idempotence });
}

async function syncResend(etape, email, prenom, origine, dejaRepondu) {
  if (!resendPret()) return "non configuré";
  const audience = process.env.RESEND_AUDIENCE_CUT;
  const chemin = `/audiences/${audience}/contacts/${encodeURIComponent(email)}`;
  if (etape === "reponse") {
    if (prenom) await resend(chemin, "PATCH", { first_name: prenom });
    return "ok";
  }
  if (etape === "relance") {
    if (dejaRepondu) return "déjà répondu";
    const lien = `${origine}/cut/sondage?email=${encodeURIComponent(email)}&utm_source=email&utm_campaign=cutai-launch&utm_content=mail-2`;
    const r = await envoi(email, mail2(lien, lienDesinscription(origine, email)), { scheduled_at: lendemainDixHeures(), idempotence: `cutai-mail2-${email}` }, origine);
    return r.ok ? "mail 2 programmé" : `erreur ${r.status}`;
  }
  const deja = await resend(chemin, "GET");
  if (deja.ok) return "déjà inscrit";
  const cree = await resend(`/audiences/${audience}/contacts`, "POST", { email, unsubscribed: false });
  if (!cree.ok) return `erreur ${cree.status}`;
  const r = await envoi(email, mail1(lienDesinscription(origine, email)), { idempotence: `cutai-mail1-${email}` }, origine);
  return r.ok ? "mail 1 envoyé" : `erreur ${r.status}`;
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

  const etape = ["reponse", "relance"].includes(corps.etape) ? corps.etape : "liste";
  const prenom = texte(corps.prenom, 40);
  const origine = `https://${req.headers.host}`;
  let contact;
  try {
    if (etape === "liste") {
      contact = await contactGHL({ email }, ["waitlist-cutai"]);
    } else if (etape === "relance") {
      contact = await contactGHL({ email });
    } else {
      const duree = Object.hasOwn(DUREES, corps.duree) ? corps.duree : null;
      if (!duree) return res.status(400).json({ ok: false, erreur: "duree" });
      const accord = corps.accord === true && prenom.length >= 2;
      const recit = texte(corps.recit, 600);
      const tags = ["waitlist-cutai", "sondage-ok", `cutai-montage-${DUREES[duree]}`];
      if (accord) tags.push("cutai-citation-ok");
      const note = [
        "Cut — réponse au sondage de la liste d'attente",
        `Temps de montage d'une vidéo : ${duree}`,
        `Comment il monte, ce qui le saoule : ${recit || "—"}`,
        `Citation autorisée : ${accord ? `oui, sous le prénom ${prenom}` : "non"}`,
      ].join("\n");
      contact = await contactGHL(prenom ? { email, firstName: prenom } : { email }, tags, note);
    }
  } catch (e) {
    console.error("cut/inscription GHL", e);
    return res.status(502).json({ ok: false });
  }

  let mail = "non tenté";
  try {
    const dejaRepondu = Array.isArray(contact?.tags) && contact.tags.includes("sondage-ok");
    mail = await syncResend(etape, email, prenom, origine, dejaRepondu);
  } catch (e) {
    console.error("cut/inscription Resend", e);
    mail = "erreur";
  }
  return res.status(200).json({ ok: true, mail });
};
