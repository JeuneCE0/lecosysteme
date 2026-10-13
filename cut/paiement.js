/* Cut : boutons de paiement du tunnel (vente, upsell, downsell).
   Vente → /api/cut/paiement (session Stripe Checkout) ; offres en un clic → /api/cut/offre (carte de la commande réutilisée).
   Avant le 30 oct à 18 h (Réunion), l'achat est fermé ; ?test-paiement=1 l'ouvre pour les essais en mode test Stripe. */
(function () {
  var LANCEMENT = Date.parse("2026-10-30T18:00:00+04:00");
  var params = new URLSearchParams(location.search);
  var ouvert = Date.now() >= LANCEMENT || params.get("test-paiement") === "1";
  var session = params.get("session_id") || "";
  var err = document.querySelector("[data-pay-err]");
  var euros = function (n) { return n + " €"; };

  function appeler(url, corps, bouton, attente) {
    var avant = bouton.innerHTML;
    bouton.disabled = true;
    bouton.textContent = attente;
    if (err) err.textContent = "";
    return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps) })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (j) { if (j && j.url) location.href = j.url; else throw new Error("sans url"); })
      .catch(function () {
        bouton.disabled = false;
        bouton.innerHTML = avant;
        if (err) err.textContent = "Le paiement n'a pas pu démarrer. Réessaie dans un instant.";
      });
  }

  /* Page de vente : Décodeur en option, total et bouton à jour */
  var bump = document.querySelector("[data-bump]");
  var total = document.querySelector("[data-total]");
  var acheter = Array.prototype.slice.call(document.querySelectorAll("[data-acheter]"));
  function prix() { return bump && bump.checked ? 84 : 67; }
  function maj() {
    if (total) total.textContent = euros(prix());
    acheter.forEach(function (b) { b.textContent = ouvert ? "Payer " + euros(prix()) : "Ouverture le 30 octobre à 18 h"; b.disabled = !ouvert; });
  }
  if (bump) bump.addEventListener("change", maj);
  acheter.forEach(function (b) {
    b.addEventListener("click", function () {
      if (!ouvert) return;
      appeler("/api/cut/paiement", { decodeur: !!(bump && bump.checked) }, b, "Redirection vers le paiement…");
    });
  });
  maj();

  /* Upsell et downsell : un clic, la carte de la commande est réutilisée ; « Non merci » garde la session */
  document.querySelectorAll("[data-offre]").forEach(function (b) {
    b.addEventListener("click", function () {
      if (!session) { if (err) err.textContent = "Ta commande est introuvable : ouvre le lien reçu par e-mail."; return; }
      appeler("/api/cut/offre", { offre: b.getAttribute("data-offre"), session_id: session }, b, "Paiement en cours…");
    });
  });
  document.querySelectorAll("[data-suivant]").forEach(function (a) {
    if (!session) return;
    var u = new URL(a.getAttribute("href"), location.href);
    u.searchParams.set("session_id", session);
    a.setAttribute("href", u.pathname + u.search);
  });
})();
