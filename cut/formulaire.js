/* Liste d'attente Cut : inscription et questionnaire, communs à /cut et /cut/sondage.
   Tout passe par /api/cut/inscription (GHL + Resend côté serveur, aucune clé ici). */
(function () {
  var KEY = "ecs_cut_v1";
  var API = "/api/cut/inscription";
  var EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
  var sheet = document.getElementById("sheet");
  var quiz = document.getElementById("quiz");
  var etat = lire();

  function lire() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function ecrire(patch) { etat = Object.assign({}, etat, patch); try { localStorage.setItem(KEY, JSON.stringify(etat)); } catch (e) {} }

  function envoyer(corps) {
    var c = new AbortController();
    var t = setTimeout(function () { c.abort(); }, 10000);
    return fetch(API, { method: "POST", signal: c.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps) })
      .then(function (r) { return r.ok; }).catch(function () { return false; }).finally(function () { clearTimeout(t); });
  }

  // Le mail 2 (« t'as répondu ? ») ne part que pour qui ferme le questionnaire sans répondre.
  function relance() {
    if (!etat.email || etat.reponse || etat.relance) return;
    ecrire({ relance: true });
    var corps = JSON.stringify({ etape: "relance", email: etat.email, site: "" });
    var ok = false;
    try { ok = navigator.sendBeacon && navigator.sendBeacon(API, new Blob([corps], { type: "application/json" })); } catch (e) {}
    if (!ok) fetch(API, { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: corps }).catch(function () {});
  }

  function inscrit(zone, email) {
    var form = zone.querySelector("[data-capture]");
    var msg = document.createElement("div");
    msg.className = "done-msg";
    msg.innerHTML = '<span class="cut-rec" aria-hidden="true"></span><span><strong>Tu es sur la liste.</strong> Tu seras prévenu dès l’ouverture, à <span data-mail></span>.</span>';
    msg.querySelector("[data-mail]").textContent = email;
    form.replaceWith(msg);
  }
  function toutesLesZones(email) {
    document.querySelectorAll("[data-zone]").forEach(function (z) { if (z.querySelector("[data-capture]")) inscrit(z, email); });
    document.querySelectorAll(".top [data-go-liste]").forEach(function (a) { a.textContent = "Tu es sur la liste"; a.removeAttribute("href"); a.setAttribute("aria-disabled", "true"); a.style.pointerEvents = "none"; });
  }

  document.querySelectorAll("[data-capture]").forEach(function (form) {
    var zone = form.closest("[data-zone]");
    var err = zone.querySelector("[data-err]");
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var input = form.querySelector('input[type="email"]');
      var email = input.value.trim().toLowerCase();
      var site = form.querySelector('input[name="site"]').value;
      err.textContent = "";
      if (site) return;
      if (!EMAIL.test(email)) {
        err.textContent = "Cet e-mail ne ressemble pas à un e-mail.";
        form.classList.remove("shake"); void form.offsetWidth; form.classList.add("shake");
        input.focus(); return;
      }
      var btn = form.querySelector("button");
      var libelle = btn.innerHTML;
      btn.disabled = true; btn.textContent = "Inscription…";
      envoyer({ etape: "liste", email: email, site: site }).then(function (ok) {
        if (!ok) {
          btn.disabled = false; btn.innerHTML = libelle;
          err.textContent = "L'inscription n'est pas passée. Réessaie dans un instant.";
          return;
        }
        ecrire({ email: email, le: new Date().toISOString(), reponse: null, relance: false });
        toutesLesZones(email);
        ouvrirQuiz();
      });
    });
  });

  function ouvrirQuiz() {
    if (!sheet || etat.reponse) return;
    sheet.hidden = false;
    document.body.style.overflow = "hidden";
    if (window.cutLenis) window.cutLenis.stop();
    var premier = quiz.querySelector('input[name="duree"]');
    if (premier) premier.focus({ preventScroll: true });
  }
  function fermerQuiz() {
    if (!sheet || sheet.hidden) return;
    sheet.hidden = true; document.body.style.overflow = "";
    if (window.cutLenis) window.cutLenis.start();
    relance();
  }
  function merci(prenom) {
    quiz.innerHTML = '<div class="merci"><svg class="coche" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29"/><path d="M20 33 l8 8 l16 -18"/></svg><p class="big"></p><p>Je lis chaque réponse. Surveille ta boîte mail&nbsp;: tu seras prévenu dès l’ouverture.</p>' + (sheet ? '<button class="cut-btn cut-btn--primary" type="button" id="quiz-fin">Fermer</button>' : '<a class="cut-btn cut-btn--primary" href="/cut">Revenir à la page Cut</a>') + '</div>';
    quiz.querySelector(".big").textContent = prenom ? "Reçu, merci " + prenom + "." : "Reçu, merci.";
    var fin = document.getElementById("quiz-fin");
    if (fin) { fin.addEventListener("click", fermerQuiz); fin.focus(); }
  }

  if (!quiz) return;
  var quizErr = document.getElementById("quiz-err");
  var champEmail = document.getElementById("q-email");
  var params = new URLSearchParams(location.search);
  if (champEmail) champEmail.value = (params.get("email") || etat.email || "").trim();

  var passer = document.getElementById("quiz-skip");
  if (passer) passer.addEventListener("click", fermerQuiz);
  if (sheet) {
    sheet.addEventListener("click", function (ev) { if (ev.target === sheet) fermerQuiz(); });
    document.addEventListener("keydown", function (ev) { if (ev.key === "Escape") fermerQuiz(); });
    window.addEventListener("pagehide", function () { if (!sheet.hidden) relance(); });
  }

  quiz.addEventListener("submit", function (ev) {
    ev.preventDefault();
    quizErr.textContent = "";
    var email = champEmail ? champEmail.value.trim().toLowerCase() : etat.email;
    var duree = (quiz.querySelector('input[name="duree"]:checked') || {}).value;
    var recit = quiz.querySelector("#q-recit").value.trim();
    var prenom = quiz.querySelector("#q-prenom").value.trim();
    var accord = quiz.querySelector("#q-accord").checked;
    if (!email || !EMAIL.test(email)) { quizErr.textContent = "Ton e-mail, celui de ton inscription."; if (champEmail) champEmail.focus(); return; }
    if (!duree) { quizErr.textContent = "Choisis une réponse."; return; }
    if (accord && prenom.length < 2) { quizErr.textContent = "Ton prénom, pour signer ta réponse."; quiz.querySelector("#q-prenom").focus(); return; }
    var go = document.getElementById("quiz-go");
    go.disabled = true; go.textContent = "Envoi…";
    envoyer({ etape: "reponse", email: email, prenom: prenom, duree: duree, recit: recit, accord: accord, site: "" }).then(function (ok) {
      if (!ok) {
        go.disabled = false; go.textContent = "Envoyer ma réponse";
        quizErr.textContent = "Ta réponse n'est pas partie. Réessaie dans un instant.";
        return;
      }
      ecrire({ email: email, reponse: duree, prenom: prenom });
      merci(prenom);
    });
  });

  if (etat.email && document.querySelector("[data-zone]")) toutesLesZones(etat.email);
})();
