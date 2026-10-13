// Désinscription de la liste Cut depuis le lien des mails 1 et 2.
// GET affiche une confirmation (les antivirus de messagerie ouvrent les liens : un GET ne désinscrit jamais).
// POST désinscrit : bouton de la page, ou désinscription en un clic des messageries (List-Unsubscribe-Post).

const { EMAIL, texte, resend, resendPret, contactGHL, signatureValide } = require("./_commun");

function page(titre, corps) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${titre} · Cut</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#efefef;color:#16130c;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif}
main{max-width:440px;padding:32px;border-radius:24px;background:#fff;box-shadow:0 1px 2px rgba(22,19,12,.06),0 12px 32px rgba(22,19,12,.07);display:grid;gap:16px}
h1{margin:0;font-size:26px;letter-spacing:-.02em}p{margin:0;color:#4a443a;line-height:1.55}
button,a.b{justify-self:start;height:46px;padding:0 22px;border:0;border-radius:999px;background:#16130c;color:#efefef;font:600 15px/46px inherit;cursor:pointer;text-decoration:none}
button:focus-visible,a.b:focus-visible{outline:2px solid #0073e6;outline-offset:3px}</style></head><body><main>${corps}</main></body></html>`;
}

module.exports = async (req, res) => {
  const email = texte(String(req.query.e || ""), 254).toLowerCase();
  const sig = String(req.query.s || "");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  if (!EMAIL.test(email) || !signatureValide(email, sig)) {
    return res.status(400).send(page("Lien invalide", "<h1>Ce lien ne marche pas.</h1><p>Réponds simplement au mail reçu en écrivant « stop », on te retire de la liste à la main.</p>"));
  }
  const affiche = email.replace(/[<>&"]/g, "");
  if (req.method === "GET") {
    return res.status(200).send(page("Désinscription", `<h1>Tu veux quitter la liste&nbsp;?</h1><p>Tu ne recevras plus les mails de Cut à <strong>${affiche}</strong>, ni celui de l'ouverture.</p><form method="post"><button type="submit">Me désinscrire</button></form>`));
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).send(page("Erreur", "<h1>Action impossible.</h1>"));
  }
  try {
    const travaux = [];
    if (resendPret()) travaux.push(resend(`/audiences/${process.env.RESEND_AUDIENCE_CUT}/contacts/${encodeURIComponent(email)}`, "PATCH", { unsubscribed: true }));
    if (process.env.GHL_PIT_TOKEN) travaux.push(contactGHL({ email }, ["desinscrit-cutai"]));
    await Promise.all(travaux);
  } catch (e) {
    console.error("cut/desinscription", e);
    return res.status(502).send(page("Erreur", "<h1>Ça n'a pas marché.</h1><p>Réessaie dans un instant, ou réponds au mail en écrivant « stop ».</p>"));
  }
  return res.status(200).send(page("Désinscrit", `<h1>C'est fait.</h1><p>Tu ne recevras plus les mails de Cut à <strong>${affiche}</strong>.</p><a class="b" href="/cut">Revenir à la page Cut</a>`));
};
