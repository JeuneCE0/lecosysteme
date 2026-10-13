// Mails 1 et 2 de la séquence d'Anthony (doc « CUT-AI · Séquence emails liste d'attente », 10 oct 2026).
// Format personnel volontairement sobre : un mail d'Anthony, pas une newsletter. Les mails 3 à 14 partent en envois groupés depuis Resend.

function echappe(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

// Un bloc = un paragraphe ; { liste: [...] } = puces ; { lien: [texte, url] } = le seul lien du mail.
function rendu(blocs, preheader, desinscription) {
  const html = blocs.map((b) => {
    if (b.liste) return `<ul style="margin:0 0 16px;padding-left:20px">${b.liste.map((l) => `<li style="margin:0 0 8px">${echappe(l)}</li>`).join("")}</ul>`;
    if (b.lien) return `<p style="margin:0 0 16px">👉 <a href="${echappe(b.lien[1])}" style="color:#c2370a;font-weight:600">${echappe(b.lien[0])}</a></p>`;
    return `<p style="margin:0 0 16px">${echappe(b).replace(/\n/g, "<br>")}</p>`;
  }).join("");
  const text = blocs.map((b) => b.liste ? b.liste.map((l) => `• ${l}`).join("\n") : b.lien ? `👉 ${b.lien[0]} : ${b.lien[1]}` : b).join("\n\n");
  return {
    html: `<!doctype html><html lang="fr"><body style="margin:0;padding:24px 16px;background:#ffffff;color:#16130c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6">
<div style="display:none;max-height:0;overflow:hidden">${echappe(preheader)}</div>
<div style="max-width:560px;margin:0 auto">${html}
<p style="margin:32px 0 0;font-size:12px;line-height:1.5;color:#6b6459">Tu reçois ce mail parce que tu t'es inscrit à la liste d'attente de Cut. <a href="${echappe(desinscription)}" style="color:#6b6459">Me désinscrire</a></p></div></body></html>`,
    text: `${text}\n\n—\nTu reçois ce mail parce que tu t'es inscrit à la liste d'attente de Cut. Me désinscrire : ${desinscription}`,
  };
}

function mail1(desinscription) {
  return {
    subject: "Tu es sur la liste Cut ✅",
    ...rendu([
      "Salutttt, c'est Anthony !",
      "C'est noté : tu es sur la liste d'attente de Cut.",
      "Cut, c'est l'outil tout-en-un qui monte tes Reels en automatique, en quelques clics, avec Claude ou ChatGPT.",
      "Fini les aprèms entières sur une vidéo.\nMaintenant l'IA le fait à ta place.",
      "Voilà ce qui va se passer :",
      { liste: [
        "D'ici l'ouverture, je te montre les coulisses. Comment je monte mes Reels, le vrai, chronomètre en main.",
        "Le vendredi 30 octobre à 18 h (heure de La Réunion), tu reçois le lien avant tout le monde, au prix waitlist.",
        "Tu décides. Pas de pression, pas de call.",
      ] },
      "Une seule chose à faire aujourd'hui : si ce mail est arrivé dans tes spams ou dans « Promotions », déplace-le dans ta boîte principale.",
      "Sinon le mail d'ouverture n'arrivera pas. Et ce serait bête de rater le prix waitlist pour ça.",
      "À très vite !\nAnthony\n@iamanthonyjonas",
      "P.S. Une question ? Réponds à ce mail. C'est moi qui lis.",
    ], "Et voilà ce qui arrive maintenant.", desinscription),
  };
}

function mail2(lienSondage, desinscription) {
  return {
    subject: "t'as répondu ? 👀",
    ...rendu([
      "Salut,",
      "Hier, juste après ton inscription, je t'ai posé une question.",
      "Tu ne l'as peut-être pas vue. Ou t'as fermé l'onglet vite fait.",
      "Je comprends. T'as une vie, des notifs, 12 onglets ouverts.",
      "Mais j'ai vraiment besoin de ta réponse.",
      "Comment tu montes tes vidéos aujourd'hui ? Et combien de temps ça te prend ?",
      "CapCut, monteur, rien du tout parce que ça te saoule… Tout m'intéresse.",
      "Pourquoi ? Parce que je prépare Cut pour les vraies galères. Pas pour celles que j'imagine.",
      "30 secondes, c'est ici :",
      { lien: ["Je réponds", lienSondage] },
      "Anthony",
      "P.S. Tu peux aussi juste répondre à ce mail. Une ligne suffit.",
    ], "J'en ai besoin pour la suite.", desinscription),
  };
}

// « Inscription + 1 jour, 10 h » à La Réunion (UTC+4, sans heure d'été) = le lendemain à 06:00 UTC.
function lendemainDixHeures(maintenant = new Date()) {
  const reunion = new Date(maintenant.getTime() + 4 * 3600 * 1000);
  return new Date(Date.UTC(reunion.getUTCFullYear(), reunion.getUTCMonth(), reunion.getUTCDate() + 1, 6, 0, 0)).toISOString();
}

module.exports = { mail1, mail2, lendemainDixHeures };
