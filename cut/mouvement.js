/* Cut : mouvement commun aux pages /cut (apparitions, défilement fluide, fenêtre de montage, règle,
   tâches barrées, compte à rebours, simulateur, barres de coût). Chaque bloc ne s'active que si sa section existe. */
(function () {
  var reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var vh = window.innerHeight;
  var memo = {};
  window.addEventListener("resize", function () { vh = window.innerHeight; memo.y = -1; });
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function borne(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lisse(p) { return p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
  function entre(t, a, b) { return borne((t - a) / (b - a), 0, 1); }
  function el(tag, cls, parent) { var e = document.createElement(tag); if (cls) e.className = cls; parent.appendChild(e); return e; }
  function texte(cle, node, v) { if (memo[cle] !== v) { memo[cle] = v; node.textContent = v; } }
  function classe(cle, node, nom, oui) { var k = cle + ":" + nom; if (memo[k] !== oui) { memo[k] = oui; node.classList.toggle(nom, oui); } }
  var io = "IntersectionObserver" in window;
  function quandVisible(node, seuil, fn) {
    if (!node) return;
    if (!io) return fn();
    new IntersectionObserver(function (e, o) { if (e[0].isIntersecting) { o.disconnect(); fn(); } }, { threshold: seuil }).observe(node);
  }

  /* Hero : les mots montent, puis la tête de lecture passe */
  var hero = $(".hero");
  if (hero) requestAnimationFrame(function () { requestAnimationFrame(function () {
    hero.classList.add("go");
    $$(".hero-copy .reveal", hero).forEach(function (e) { e.classList.add("in"); });
  }); });

  /* Apparitions au défilement */
  var obs = io ? new IntersectionObserver(function (entrees) {
    entrees.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); obs.unobserve(e.target); } });
  }, { rootMargin: "0px 0px -8% 0px" }) : null;
  $$(".reveal").forEach(function (e) { if (e.closest(".hero-copy")) return; if (obs) obs.observe(e); else e.classList.add("in"); });

  /* Titres « allumés » par la tête de lecture */
  $$("[data-allume]").forEach(function (a) { if (reduit) a.classList.add("on"); else quandVisible(a, .6, function () { a.classList.add("on"); }); });

  /* Cartes sombres : halo qui suit le curseur ; barres du son */
  $$(".carte").forEach(function (c) {
    c.addEventListener("pointermove", function (ev) { var r = c.getBoundingClientRect(); c.style.setProperty("--mx", (ev.clientX - r.left) + "px"); c.style.setProperty("--my", (ev.clientY - r.top) + "px"); });
  });
  $$("[data-barres]").forEach(function (barres) {
    for (var k = 0; k < 22; k++) { var b = el("i", "", barres); b.style.setProperty("--k", (k * 7) % 11); b.style.height = (38 + ((k * 37) % 50)) + "%"; }
  });

  /* Barres de coût à l'échelle (page de vente) */
  $$("[data-echelle]").forEach(function (bloc) {
    quandVisible(bloc, .4, function () { $$("[data-v]", bloc).forEach(function (b, i) { setTimeout(function () { b.style.setProperty("--w", b.getAttribute("data-v") + "%"); }, reduit ? 0 : i * 180); }); });
  });

  /* Fenêtre de montage : un rush brut de 12:48 devient un Reel de 20 s, boucle de 12 s */
  var ed = $("[data-editor]"), rendu = null, edVisible = false;
  if (ed) (function () {
    var PH = { A: [0, 1.6], B: [1.6, 3.4], C: [3.4, 5], D: [5, 6.4], E: [6.4, 11.4], F: [11.4, 12] };
    var BRUT = [[0, 18], [30, 14], [56, 18], [84, 16]];
    var BLANCS = [[18, 12], [44, 12], [74, 10]];
    var MONTE = (function () { var tot = 0, acc = 0; BRUT.forEach(function (c) { tot += c[1]; }); return BRUT.map(function (c) { var r = [acc / tot * 100, c[1] / tot * 100]; acc += c[1]; return r; }); })();
    var MOTS = [["Fini", 2, 11, 0], ["les", 14, 10, 0], ["après-midi", 28, 19, 1], ["sur", 50, 9, 2], ["une", 61, 10, 2], ["vidéo.", 78, 18, 3]];
    var CLES = [MONTE[1][0], MONTE[2][0], MONTE[3][0], 86];
    var ZOOMS = [[MONTE[1][0], MONTE[1][1]], [78, 18]];
    var TEINTES = ["linear-gradient(90deg,#7a5232,#c98a4a)", "linear-gradient(90deg,#6a4529,#a8743f)", "linear-gradient(90deg,#3b3631,#d9d4cc)", "linear-gradient(90deg,#1f3646,#3f8f9c)"];
    var laneV = $('[data-lane="video"]', ed), laneM = $('[data-lane="mots"]', ed), laneA = $('[data-lane="anims"]', ed);
    var clips = BRUT.map(function (c, i) { var e = el("i", "clip", laneV); e.style.setProperty("--th", TEINTES[i]); return e; });
    var blancs = BLANCS.map(function () { var e = el("i", "blanc", laneV); e.textContent = "blanc"; return e; });
    var coupes = MONTE.slice(1).map(function (c) { var e = el("i", "coupe", laneV); e.style.left = c[0] + "%"; return e; });
    var mots = MOTS.map(function (m) { var e = el("span", "mot", laneM); e.textContent = m[0].toUpperCase(); e.style.left = m[1] + "%"; e.style.width = m[2] + "%"; return e; });
    var zooms = ZOOMS.map(function (z) { var e = el("i", "zoom", laneA); e.style.left = z[0] + "%"; e.style.width = z[1] + "%"; return e; });
    var cles = CLES.map(function (x) { var e = el("i", "cle", laneA); e.style.left = x + "%"; return e; });
    var onde = $("[data-onde]", ed);
    for (var j = 0; j < 64; j++) el("i", "", onde).style.setProperty("--h", (22 + Math.abs(Math.sin(j * 1.7) * 52 + Math.sin(j * .45) * 22)) + "%");
    var scenes = $$(".scene", ed), viewer = $("[data-viewer]", ed), flash = $("[data-flash]", ed);
    var ph = $("[data-ph]", ed), cap = $("[data-caption]", ed), tc = $("[data-tc]", ed), raw = $("[data-raw]", ed);
    var statut = $("[data-status]", ed), etapes = $$("[data-steps] li", ed);
    var R = { duree: $('[data-r="duree"]', ed), blancs: $('[data-r="blancs"]', ed), mots: $('[data-r="mots"]', ed), anims: $('[data-r="anims"]', ed) };
    function mmss(s) { s = Math.round(s); return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2); }
    rendu = function (t) {
      var pB = lisse(entre(t, PH.B[0], PH.B[1])), pC = entre(t, PH.C[0], PH.C[1]), pD = entre(t, PH.D[0], PH.D[1]), pE = entre(t, PH.E[0], PH.E[1]);
      clips.forEach(function (c, i) { c.style.left = (BRUT[i][0] + (MONTE[i][0] - BRUT[i][0]) * pB) + "%"; c.style.width = (BRUT[i][1] + (MONTE[i][1] - BRUT[i][1]) * pB) + "%"; });
      blancs.forEach(function (b, i) { var fin = MONTE[i][0] + MONTE[i][1]; b.style.left = (BLANCS[i][0] + (fin - BLANCS[i][0]) * pB) + "%"; b.style.width = (BLANCS[i][1] * (1 - pB)) + "%"; b.style.opacity = 1 - pB; });
      coupes.forEach(function (c) { c.style.opacity = borne((pB - .75) * 4, 0, 1); });
      var nMots = 0; mots.forEach(function (m, i) { var on = pC > (i + .5) / mots.length; if (on) nMots++; classe("m" + i, m, "on", on); });
      var nCles = 0; cles.forEach(function (c, i) { var on = pD > (i + .5) / cles.length; if (on) nCles++; classe("c" + i, c, "on", on); });
      var nZooms = 0; zooms.forEach(function (z, i) { var on = pD > (i * 2 + 1) / 4; if (on) nZooms++; classe("z" + i, z, "on", on); });
      var at = t < PH.B[0] ? entre(t, PH.A[0], PH.A[1]) : t < PH.E[0] ? 0 : t < PH.F[0] ? pE : 1;
      ph.style.setProperty("--at", at.toFixed(4));
      var lecture = t >= PH.E[0] && t < PH.F[0];
      classe("brut", viewer, "brut", t < PH.E[0]);
      raw.style.opacity = t < PH.B[1] ? 1 : 0;
      var pos = pE * 100, sc = 0;
      if (lecture) for (var i = 0; i < MONTE.length; i++) if (pos >= MONTE[i][0]) sc = i;
      if (memo.scene !== sc) {
        if (memo.scene !== undefined && lecture) { flash.classList.remove("go"); void flash.offsetWidth; flash.classList.add("go"); }
        memo.scene = sc;
        scenes.forEach(function (s, n) { s.classList.toggle("on", n === sc); });
      }
      var actif = -1;
      if (lecture) for (var m = 0; m < MOTS.length; m++) if (pos >= MOTS[m][1] - 1) actif = m;
      var groupe = actif < 0 ? -1 : MOTS[actif][3], cleCap = groupe + ":" + actif;
      if (memo.cap !== cleCap) {
        memo.cap = cleCap; cap.textContent = "";
        if (groupe >= 0) MOTS.forEach(function (mm, n) { if (mm[3] !== groupe || n > actif) return; el("span", n === actif ? "now" : "", cap).textContent = mm[0]; });
      }
      texte("tc", tc, "00:00:" + ("0" + Math.floor(lecture ? pE * 20 : t >= PH.F[0] ? 20 : 0)).slice(-2));
      texte("duree", R.duree, t < PH.B[0] ? "12:48" : mmss(768 + (20 - 768) * pB));
      classe("dh", R.duree, "hot", t >= PH.B[0] && t < PH.B[1] + .3);
      texte("blancs", R.blancs, String(Math.round(3 * pB)));
      texte("mots", R.mots, String(nMots));
      texte("anims", R.anims, String(nCles + nZooms));
      var phase = t < PH.B[0] ? 0 : t < PH.C[0] ? 1 : t < PH.D[0] ? 2 : t < PH.E[0] ? 3 : 4;
      etapes.forEach(function (li, n) { classe("e" + n, li, "on", n === phase); classe("e" + n, li, "ok", n < phase); });
      texte("statut", statut, ["Analyse du rush…", "Coupe des blancs…", "Sous-titres…", "Animations…", "Prêt à publier · 0:20"][phase]);
      classe("ed", ed, "reset", t >= PH.F[0]);
    };
    if (io) new IntersectionObserver(function (e) { edVisible = e[0].isIntersecting; }, { threshold: .05 }).observe(ed); else edVisible = true;
    rendu(reduit ? 8.7 : 0);
  })();

  /* Défilement fluide (Lenis, comme lecosysteme.com) */
  var lenis = null;
  function demarrerLenis() {
    if (lenis || reduit || !window.Lenis) return;
    lenis = new window.Lenis({ lerp: .1, smoothWheel: true });
    window.cutLenis = lenis;
  }
  demarrerLenis();
  window.addEventListener("load", demarrerLenis);
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (ev) {
      var id = a.getAttribute("href");
      if (id.length < 2) return;
      var cible = document.querySelector(id);
      if (!cible) return;
      ev.preventDefault();
      if (lenis) lenis.scrollTo(cible, { offset: -80, duration: 1.2 }); else cible.scrollIntoView({ behavior: reduit ? "auto" : "smooth" });
      var champ = a.hasAttribute("data-go-liste") ? document.getElementById("email-haut") : null;
      if (champ) setTimeout(function () { champ.focus({ preventScroll: true }); }, lenis ? 1250 : 700);
    });
  });

  /* Règle de timecodes qui défile avec la page */
  var regle = $("[data-regle]"), PAS = 120, graduations = [];
  if (regle) for (var g = 0, N = Math.ceil(Math.max(window.screen.width, window.innerWidth) / PAS) + 4; g < N; g++) graduations.push(el("span", "", regle));
  function tcRegle(n) { var s = n * 2; return "00:" + ("0" + Math.floor(s / 60) % 60).slice(-2) + ":" + ("0" + (s % 60)).slice(-2); }

  var taches = $$("[data-taches] li");
  var entete = $("[data-top]"), mbar = $("[data-mbar]"), stage = $(".stage");
  var zoneHaut = $(".hero [data-zone]"), zoneBas = $(".last [data-zone]");
  var cachentBarre = $$("[data-cache-barre]"), montrentBarre = $$("[data-montre-barre]");

  /* Compte à rebours : texte d'attente jusqu'à la fenêtre, puis le décompte ; data-fin = texte une fois l'heure passée */
  var blocs = $$("[data-decompte]");
  if (blocs.length) {
    var deux = function (n) { return (n < 10 ? "0" : "") + n; };
    var attr = function (b, n, d) { var v = b.getAttribute(n); return v === null ? d : v; };
    var majDecompte = function () {
      blocs.forEach(function (b) {
        var cible = Date.parse(attr(b, "data-cible", "2026-10-30T18:00:00+04:00"));
        var fenetre = +attr(b, "data-fenetre", 8) * 86400000;
        var reste = cible - Date.now(), lab, html;
        if (reste <= 0) { lab = attr(b, "data-fin-label", "C'est ouvert"); html = attr(b, "data-fin", '<a href="/cut/vente">Découvrir Cut →</a>'); }
        else if (reste > fenetre) { lab = attr(b, "data-attente-label", "Ouverture"); html = attr(b, "data-attente", "fin octobre"); }
        else {
          var s = Math.floor(reste / 1000);
          lab = attr(b, "data-label", "Ouverture dans");
          html = deux(Math.floor(s / 86400)) + "<small>j</small>" + deux(Math.floor(s % 86400 / 3600)) + "<small>h</small>" + deux(Math.floor(s % 3600 / 60)) + "<small>min</small>" + deux(s % 60) + "<small>s</small>";
        }
        var t = $(".tcode", b), l = $(".cut-tc", b);
        if (t.innerHTML !== html) t.innerHTML = html;
        if (l.textContent !== lab) l.textContent = lab;
      });
    };
    majDecompte();
    setInterval(majDecompte, 1000);
  }

  /* Simulateur : (temps d'aujourd'hui − 15 min par Reel) × Reels par semaine × 4 semaines */
  var simu = $("[data-simu]");
  if (simu) (function () {
    var rn = document.getElementById("r-n"), rt = document.getElementById("r-t"), o = {}, b = {};
    $$("[data-o]", simu).forEach(function (e) { o[e.getAttribute("data-o")] = e; });
    $$("[data-b]", simu).forEach(function (e) { b[e.getAttribute("data-b")] = e; });
    function duree(h) { var tot = Math.round(h * 60), hh = Math.floor(tot / 60), mm = tot % 60; return hh ? hh + " h" + (mm ? " " + (mm < 10 ? "0" : "") + mm : "") : mm + " min"; }
    var vu = !io, affiche = 0, cible = 0, boucle = null;
    function compte() {
      affiche = reduit ? cible : affiche + (cible - affiche) * .16;
      if (Math.abs(cible - affiche) < .5) affiche = cible;
      o.gagne.textContent = "≈ " + Math.round(affiche) + " h";
      boucle = affiche === cible ? null : requestAnimationFrame(compte);
    }
    function maj() {
      var n = +rn.value, t = +rt.value, avant = n * t, apres = n * .25;
      [rn, rt].forEach(function (r) { r.style.setProperty("--p", ((r.value - r.min) / (r.max - r.min) * 100) + "%"); });
      o.n.textContent = n; o.t.textContent = duree(t);
      o.avant.textContent = duree(avant) + " / sem."; o.apres.textContent = duree(apres) + " / sem.";
      if (!vu) return;
      b.avant.style.setProperty("--w", "100%");
      b.apres.style.setProperty("--w", Math.max(2, apres / avant * 100) + "%");
      cible = Math.round(Math.max(0, (avant - apres) * 4));
      if (!boucle) boucle = requestAnimationFrame(compte);
    }
    rn.addEventListener("input", maj); rt.addEventListener("input", maj);
    quandVisible(simu, .35, function () { vu = true; setTimeout(maj, 350); });
    maj();
  })();

  /* Boucle unique : en-tête, inclinaison, règle, tâches, barres collantes, fenêtre de montage */
  var horloge = 0, dernier = null;
  function image(maintenant) {
    if (lenis) lenis.raf(maintenant);
    var y = window.scrollY;
    if (memo.y !== y) {
      memo.y = y;
      if (entete) classe("top", entete, "scrolled", y > 8);
      if (stage && ed && !reduit) {
        var r = stage.getBoundingClientRect(), p = borne((vh - r.top) / (vh * .75), 0, 1);
        ed.style.setProperty("--tilt", (16 * (1 - p)).toFixed(2) + "deg");
        ed.style.setProperty("--sc", (.92 + .08 * p).toFixed(4));
      }
      if (regle) {
        var dec = y * .8, base = Math.floor(dec / PAS);
        regle.style.transform = "translate3d(" + (-(dec % PAS)).toFixed(1) + "px,0,0)";
        if (memo.base !== base) { memo.base = base; graduations.forEach(function (s, n) { s.textContent = tcRegle(base + n); }); }
      }
      taches.forEach(function (li, n) { var rr = li.getBoundingClientRect(); classe("t" + n, li, "barre", reduit || rr.top + rr.height / 2 < vh * .62); });
      if (mbar) {
        var montrer;
        if (zoneHaut && zoneBas) montrer = !!$("[data-capture]", zoneHaut) && zoneHaut.getBoundingClientRect().bottom < 0 && zoneBas.getBoundingClientRect().top > vh;
        else montrer = montrentBarre.some(function (n) { return n.getBoundingClientRect().bottom < 0; }) && !cachentBarre.some(function (n) { var rc = n.getBoundingClientRect(); return rc.top < vh && rc.bottom > 0; });
        classe("mbar", mbar, "on", montrer);
      }
    }
    if (rendu && !reduit && edVisible && !document.hidden) {
      if (dernier !== null) horloge = (horloge + Math.min(.1, (maintenant - dernier) / 1000)) % 12;
      dernier = maintenant;
      rendu(horloge);
    } else dernier = null;
    requestAnimationFrame(image);
  }
  requestAnimationFrame(image);
})();
