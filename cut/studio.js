/* Cut Studio : moteur des pages v2. La page est une séquence ouverte dans un logiciel de montage.
   Le défilement avance la tête de lecture ; chaque <section data-scene> est une scène de la timeline.
   Attributs d'une scène : data-duree (s), data-plan / data-plan2 (rushs), data-reel="x y échelle rotation opacité"
   (position du calque Reel dans la composition 16:9, en %), data-zoom="début fin", data-etal="début fin" (0 = brut, 1 = étalonné),
   data-volet (comparaison), data-sous="sous-titre|suivant" ; dans la scène, data-k="début fin" anime --k de 0 à 1. */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var borne = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var doux = function (x) { return x * x * (3 - 2 * x); };
  var sortie = function (x) { return 1 - Math.pow(1 - x, 3); };
  var reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var mqMobile = window.matchMedia("(max-width: 860px)");
  var econome = !!(navigator.connection && navigator.connection.saveData);
  var studio = $("[data-studio]"), comp = $("[data-comp]");
  if (!studio || !comp) return;
  var MEDIA = studio.getAttribute("data-media") || "/cut/media/v2/";
  var FPS = 30;
  var COULEURS = ["#ff4b0f", "#ff9d00", "#8b6cff", "#2fb38f", "#3d8bff", "#e5487a", "#c9a227", "#5cc8ff"];

  function nombres(txt, defaut) {
    var v = (txt || "").trim().split(/\s+/).filter(Boolean).map(Number);
    return defaut.map(function (d, j) { return isFinite(v[j]) ? v[j] : (j > 0 && isFinite(v[j - 1]) && defaut.length === 2 ? v[j - 1] : d); });
  }
  function deux(n) { return (n < 10 ? "0" : "") + n; }
  function tc(t, court) {
    var f = Math.floor(t * FPS), s = Math.floor(f / FPS);
    return (court ? "" : "00:") + deux(Math.floor(s / 60)) + ":" + deux(s % 60) + (court ? "" : ":" + deux(f % FPS));
  }
  function el(tag, cls, parent, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    if (parent) parent.appendChild(e);
    return e;
  }

  /* Sous-titres mot par mot : chaque mot devient un <span class="m">, les mots en <em>/<b> sont « chauds » */
  function decouper(bloc) {
    var sortieMots = [];
    (function marcher(noeud, chaud) {
      Array.prototype.slice.call(noeud.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          // Seuls les espaces ordinaires séparent les mots : l'espace insécable garde « vidéo ? » d'un seul tenant.
          var parts = n.textContent.split(/([ \t\n\r\f]+)/), frag = document.createDocumentFragment();
          parts.forEach(function (p) {
            if (!p) return;
            if (/^[ \t\n\r\f]+$/.test(p)) { frag.appendChild(document.createTextNode(" ")); return; }
            var m = document.createElement("span");
            m.className = "m" + (chaud ? " chaud" : "");
            m.textContent = p;
            frag.appendChild(m);
            sortieMots.push(m);
          });
          n.parentNode.replaceChild(frag, n);
        } else if (n.nodeType === 1 && n.tagName !== "BR") {
          marcher(n, chaud || n.tagName === "EM" || n.tagName === "B");
        }
      });
    })(bloc, false);
    return sortieMots;
  }

  /* Scènes */
  var debut = 0;
  var S = $$("[data-scene]", comp).map(function (e, i) {
    var d = e.dataset;
    var s = {
      el: e, i: i, id: e.id, titre: d.titre || "Scène " + (i + 1), debut: debut, duree: +d.duree || 6,
      plan: d.plan || "face", plan2: d.plan2 || "", etal: nombres(d.etal, [1, 1]), zoom: nombres(d.zoom, [1.04, 1.12]),
      pose: nombres(d.reel, [72, 50, .9, 0, 1]), volet: "volet" in d, couleur: d.c || COULEURS[i % COULEURS.length],
      sous: d.sous ? d.sous.split("|").map(function (g) { return g.trim().split(/\s+/); }) : null,
      maintien: d.maintien ? +d.maintien : .42, ks: []
    };
    s.fin = s.debut + s.duree;
    debut = s.fin;
    var auto = 0;
    $$("[data-k]", e).forEach(function (k) {
      var v = k.getAttribute("data-k").trim().split(/\s+/).filter(Boolean).map(Number), a, b;
      if (v.length >= 2) { a = v[0]; b = v[1]; } else { a = .03 + auto * .05; b = a + .14; auto++; }
      var item = { el: k, a: a, b: b, v: -1, mots: k.hasAttribute("data-mots") ? decouper(k) : null };
      var c = k.getAttribute("data-compte");
      if (c !== null) item.compte = { de: +(k.getAttribute("data-de") || 0), a: +c, format: k.getAttribute("data-format") || "#" };
      s.ks.push(item);
    });
    return s;
  });
  if (!S.length) return;
  var TOTAL = debut;
  function sceneA(t) { for (var i = S.length - 1; i >= 0; i--) if (t >= S[i].debut) return i; return 0; }
  function parId(id) { for (var i = 0; i < S.length; i++) if (S[i].id === id) return S[i]; return null; }

  function chiffre(n, format) {
    if (format === "mmss") { var sec = Math.round(n); return deux(Math.floor(sec / 60)) + ":" + deux(sec % 60); }
    if (format === "duree") {
      var m = Math.round(n), h = Math.floor(m / 60), r = m % 60;
      return h ? h + " h" + (r ? " " + deux(r) : "") : m + " min";
    }
    var txt = Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return format.replace("#", txt);
  }

  /* Défilement : 1 seconde de timeline = pps pixels */
  var piste = $("[data-piste]");
  var pps = 100, largeurVue = 0;
  function mesurer(force) {
    var w = window.innerWidth;
    if (!force && w === largeurVue) return;
    largeurVue = w;
    var t = tCourant;
    pps = Math.max(80, document.documentElement.clientHeight * (mqMobile.matches ? .13 : .15));
    piste.style.height = Math.ceil(TOTAL * pps + document.documentElement.clientHeight) + "px";
    if (t > 0) defilerImmediat(t * pps);
  }

  var lenis = null;
  function demarrerLenis() {
    if (lenis || reduit || !window.Lenis) return;
    lenis = new window.Lenis({ lerp: .1, smoothWheel: true });
    window.cutLenis = lenis;
  }
  function defilerImmediat(y) {
    if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
    else window.scrollTo(0, y);
  }
  function aller(t, douce) {
    t = borne(t, 0, TOTAL - .001);
    var y = t * pps;
    if (gel) { gel = false; }
    if (!douce || reduit) { defilerImmediat(y); return; }
    if (lenis) lenis.scrollTo(y, { duration: Math.min(1.6, .6 + Math.abs(y - window.scrollY) / 4000), force: true });
    else window.scrollTo({ top: y, behavior: "smooth" });
  }
  function allerScene(s, douce) { if (s) aller(s.debut + s.duree * s.maintien, douce !== false); }

  /* Lecture : la tête de lecture avance d'elle-même (barre d'espace, bouton ▶, intro) */
  var lecture = false, finLecture = TOTAL, vitesse = 1, tLecture = 0;
  function lire(jusqua, v) {
    lecture = true; vitesse = v || 1;
    finLecture = Math.min(TOTAL - .001, jusqua || TOTAL);
    tLecture = tCourant;
    yImpose = -1;
    studio.classList.add("joue");
    $$("[data-lecture]").forEach(function (b) { b.setAttribute("aria-label", "Pause"); b.setAttribute("aria-pressed", "true"); });
  }
  function arreter() {
    if (!lecture) return;
    lecture = false;
    studio.classList.remove("joue");
    $$("[data-lecture]").forEach(function (b) { b.setAttribute("aria-label", "Lecture"); b.setAttribute("aria-pressed", "false"); });
  }
  ["wheel", "touchstart"].forEach(function (n) { window.addEventListener(n, function (ev) { if (!ev.target.closest || !ev.target.closest("[data-lecture]")) arreter(); attente(); }, { passive: true }); });

  /* Champ de saisie actif dans la composition : on fige la tête de lecture (le clavier mobile fait défiler la page) */
  var gel = false, tGel = 0;
  comp.addEventListener("focusin", function (ev) {
    if (!/^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName) || ev.target.type === "range") return;
    gel = true; tGel = tCourant; arreter();
  });
  comp.addEventListener("focusout", function () {
    setTimeout(function () {
      var a = document.activeElement;
      if (a && comp.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
      if (gel) { gel = false; defilerImmediat(tGel * pps); }
    }, 120);
  });

  /* Rendu vidéo WebGL2 des rushs (repli Canvas 2D, puis image fixe) */
  var reel = $("[data-reel]"), canvas = reel && $("canvas", reel), poster = reel && $("[data-poster]", reel);
  var ambi = $("[data-ambi]"), ctxAmbi = ambi && ambi.getContext("2d");
  var flash = $("[data-flash]"), sousEl = $("[data-sous]");
  var videos = {}, textures = {}, derniers = {}, gl = null, prog, loc = {}, ctx2d = null;
  var sansVideo = reduit || econome || !canvas;
  var VS = "#version 300 es\nin vec2 p;out vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}";
  var FS = [
    "#version 300 es", "precision highp float;", "in vec2 v;out vec4 o;",
    "uniform sampler2D t,t2;uniform vec2 ts,ts2,vs;uniform float zoom,grade,cut,grain,tm,wipe,deux;",
    "float h(vec2 q){return fract(sin(dot(q,vec2(12.9898,78.233)))*43758.5453);}",
    "vec2 couv(vec2 q,vec2 s0){float ra=vs.x/vs.y,rt=s0.x/s0.y;vec2 s=ra>rt?vec2(1.,rt/ra):vec2(ra/rt,1.);return (q-.5)*s/zoom+.5;}",
    "vec3 lire(sampler2D x,vec2 q,vec2 s0){float a=.008*cut;vec2 u=couv(q,s0);return vec3(texture(x,u+vec2(a,0.)).r,texture(x,u).g,texture(x,u-vec2(a,0.)).b);}",
    "vec3 brut(vec3 c){float l=dot(c,vec3(.299,.587,.114));c=mix(vec3(l),c,.38);return c*.74+.12;}",
    "vec3 fin(vec3 c){vec3 w=c*vec3(1.07,1.,.92);w=w*w*(3.-2.*w);w=mix(w,w*vec3(1.,.97,.9)+vec3(.02,.01,0.),.5);float l=dot(w,vec3(.299,.587,.114));w=mix(vec3(l),w,1.14);return clamp(w*1.05,0.,1.);}",
    "void main(){vec2 q=v;",
    " if(cut>0.){float b=floor(q.y*22.);q.x+=(h(vec2(b,floor(tm*24.)))-.5)*.16*cut;}",
    " vec3 c=lire(t,q,ts);",
    " if(wipe>=0.){float m=smoothstep(wipe-.002,wipe+.002,v.x);vec3 d=deux>.5?fin(lire(t2,q,ts2)):brut(c);c=mix(fin(c),d,m);}",
    " else c=mix(brut(c),fin(c),grade);",
    " float vg=smoothstep(1.15,.3,length((v-.5)*vec2(1.,1.25)));c*=mix(1.,vg,.45);",
    " c+=(h(v*vs+fract(tm*7.)*100.)-.5)*grain;",
    " c+=cut*.14;o=vec4(c,1.);}"
  ].join("\n");

  function shader(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function texture() {
    var tx = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tx);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([20, 18, 14, 255]));
    return tx;
  }
  if (!sansVideo) {
    try {
      gl = canvas.getContext("webgl2", { alpha: false, antialias: false, powerPreference: "high-performance" });
      if (gl) {
        prog = gl.createProgram();
        gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS));
        gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS));
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
        gl.useProgram(prog);
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        var pa = gl.getAttribLocation(prog, "p");
        gl.enableVertexAttribArray(pa); gl.vertexAttribPointer(pa, 2, gl.FLOAT, false, 0, 0);
        ["t", "t2", "ts", "ts2", "vs", "zoom", "grade", "cut", "grain", "tm", "wipe", "deux"].forEach(function (n) { loc[n] = gl.getUniformLocation(prog, n); });
        gl.uniform1i(loc.t, 0); gl.uniform1i(loc.t2, 1);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        canvas.addEventListener("webglcontextlost", function (e) { e.preventDefault(); gl = null; sansVideo = true; reel.classList.remove("gl"); });
      }
    } catch (e) { gl = null; }
    if (!gl) ctx2d = canvas.getContext("2d");
  }

  function video(plan) {
    if (sansVideo || !plan) return null;
    if (videos[plan]) return videos[plan];
    var v = document.createElement("video");
    v.muted = true; v.loop = true; v.playsInline = true; v.preload = "auto";
    v.setAttribute("muted", ""); v.setAttribute("playsinline", ""); v.setAttribute("webkit-playsinline", "");
    // Les navigateurs sans H.264 (Chromium libre, certains Linux) reçoivent la version WebM (VP9) du même plan.
    var h264 = v.canPlayType('video/mp4; codecs="avc1.4d401f"');
    v.src = MEDIA + plan + (!h264 && v.canPlayType('video/webm; codecs="vp9"') ? ".webm" : ".mp4");
    videos[plan] = v;
    if (gl) textures[plan] = texture();
    return v;
  }
  function jouer(plans) {
    Object.keys(videos).forEach(function (k) {
      var v = videos[k];
      if (plans.indexOf(k) >= 0) { if (v.paused) { var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); } }
      else if (!v.paused) v.pause();
    });
  }
  function envoyer(plan, unite) {
    var v = videos[plan];
    if (!v || v.readyState < 2) return false;
    gl.activeTexture(unite ? gl.TEXTURE1 : gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textures[plan]);
    if (derniers[plan] !== v.currentTime) {
      try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, v); derniers[plan] = v.currentTime; } catch (er) {}
    }
    return true;
  }
  function taille() {
    var d = Math.min(window.devicePixelRatio || 1, mqMobile.matches ? 2 : 1.75);
    var w = Math.max(2, Math.round(canvas.offsetWidth * d)), h = Math.max(2, Math.round(canvas.offsetHeight * d));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  }
  function dessiner(s, p, coupe, horloge, volet) {
    if (sansVideo) return;
    var v = videos[s.plan];
    if (!v) return;
    taille();
    var etal = s.etal[0] + (s.etal[1] - s.etal[0]) * doux(borne((p - .08) / .6, 0, 1));
    var zoom = s.zoom[0] + (s.zoom[1] - s.zoom[0]) * p;
    if (gl) {
      if (!envoyer(s.plan, 0)) return;
      var v2 = s.plan2 ? videos[s.plan2] : null, deuxPlans = !!(v2 && envoyer(s.plan2, 1));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(loc.ts, v.videoWidth || 9, v.videoHeight || 16);
      gl.uniform2f(loc.ts2, (v2 && v2.videoWidth) || 9, (v2 && v2.videoHeight) || 16);
      gl.uniform2f(loc.vs, canvas.width, canvas.height);
      gl.uniform1f(loc.zoom, zoom);
      gl.uniform1f(loc.grade, etal);
      gl.uniform1f(loc.cut, coupe);
      gl.uniform1f(loc.grain, .045);
      gl.uniform1f(loc.tm, horloge);
      gl.uniform1f(loc.wipe, volet);
      gl.uniform1f(loc.deux, deuxPlans ? 1 : 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    } else if (ctx2d && v.readyState >= 2) {
      var cw = canvas.width, ch = canvas.height, vw = v.videoWidth, vh = v.videoHeight, k = Math.max(cw / vw, ch / vh) * zoom;
      ctx2d.filter = etal < .5 ? "saturate(.4) contrast(.8) brightness(1.08)" : "saturate(1.15) contrast(1.05)";
      ctx2d.drawImage(v, (cw - vw * k) / 2, (ch - vh * k) / 2, vw * k, vh * k);
    }
    if (!reel.classList.contains("gl")) reel.classList.add("gl");
    if (ctxAmbi && (images++ & 3) === 0 && !mqMobile.matches) { try { ctxAmbi.drawImage(v, 0, 0, ambi.width, ambi.height); } catch (e) {} }
  }
  var images = 0;

  /* Timeline */
  var tl = $("[data-tl]"), rail = tl && $("[data-rail]", tl), tete = tl && $("[data-tete]", tl), vue = tl && $(".st-tl-vue", tl);
  var clipsT = [], clipsV = [], joue = null, PPS_TL = 44;
  if (rail) (function () {
    var pc = function (t) { return (t / TOTAL * 100).toFixed(4) + "%"; };
    rail.style.setProperty("--pas", (100 / TOTAL).toFixed(5) + "%");
    var regle = el("div", "st-tl-regle", rail);
    for (var t = 0; t <= TOTAL; t += 5) { var g = el("span", "", regle, tc(t, true)); g.style.left = pc(t); }
    S.forEach(function (s) {
      if (!s.el.hasAttribute("data-marque")) return;
      var m = el("i", "st-tl-marque", regle); m.style.left = pc(s.debut); m.title = s.el.getAttribute("data-marque");
    });
    var pistes = el("div", "st-tl-pistes", rail);
    var pT = el("div", "st-tl-piste", pistes), pV = el("div", "st-tl-piste", pistes), pF = el("div", "st-tl-piste", pistes), pA = el("div", "st-tl-piste", pistes);
    S.forEach(function (s) {
      var c = el("button", "st-clip st-clip--titre", pT);
      c.type = "button"; c.style.left = pc(s.debut); c.style.width = pc(s.duree); c.style.setProperty("--c", s.couleur);
      c.innerHTML = "<span></span>"; c.firstChild.textContent = s.titre;
      c.setAttribute("aria-label", "Aller à la scène « " + s.titre + " »"); c.tabIndex = -1;
      c.addEventListener("click", function () { if (!glisse) allerScene(s); });
      clipsT.push(c);
      var v = el("div", "st-clip st-clip--video", pV);
      v.style.left = pc(s.debut); v.style.width = pc(s.duree); v.style.setProperty("--img", "url(" + MEDIA + s.plan + ".jpg)");
      v.innerHTML = "<span>" + s.plan + (s.etal[1] < .5 ? "_brut" : "") + ".mov</span>";
      clipsV.push(v);
      var cle = el("i", "st-tl-cle", pF); cle.style.left = pc(s.debut + s.duree * .22);
      if (s.i > 0) { var f = el("div", "st-clip st-clip--fx", pF); f.style.left = pc(s.debut - .3); f.style.width = pc(.6); f.title = "Coupe glitch"; }
      if (s.volet) { var fv = el("div", "st-clip st-clip--fx st-clip--long", pF, "<span>Volet</span>"); fv.style.left = pc(s.debut + s.duree * .1); fv.style.width = pc(s.duree * .8); }
    });
    var onde = el("div", "st-tl-onde", pA), graine = 7, n = Math.round(TOTAL * 4);
    for (var j = 0; j < n; j++) {
      graine = (graine * 9301 + 49297) % 233280;
      var hz = 18 + (graine / 233280) * 62 * (.55 + .45 * Math.abs(Math.sin(j / 9)));
      el("i", "", onde).style.setProperty("--h", hz.toFixed(0) + "%");
    }
    joue = el("div", "st-tl-joue", pistes);
  })();

  var glisse = false;
  if (tl) (function () {
    var corps = tl, x0 = 0, t0 = 0, actif = false;
    function tDepuis(ev) { var r = vue.getBoundingClientRect(); return borne((ev.clientX - r.left) / r.width, 0, 1) * TOTAL; }
    corps.addEventListener("pointerdown", function (ev) {
      if (ev.button !== 0) return;
      actif = true; glisse = false; x0 = ev.clientX; t0 = tCourant; arreter();
      try { corps.setPointerCapture(ev.pointerId); } catch (e) {}
      if (!mqMobile.matches) aller(tDepuis(ev), false);
    });
    corps.addEventListener("pointermove", function (ev) {
      if (!actif) return;
      if (Math.abs(ev.clientX - x0) > 4) glisse = true;
      if (!glisse) return;
      aller(mqMobile.matches ? t0 - (ev.clientX - x0) / PPS_TL : tDepuis(ev), false);
    });
    var fin = function () { actif = false; setTimeout(function () { glisse = false; }, 0); attente(); };
    corps.addEventListener("pointerup", fin);
    corps.addEventListener("pointercancel", fin);
  })();

  /* Panneaux : calques (scènes), bac de médias, inspecteur */
  var calques = [];
  var listeCalques = $("[data-calques]");
  if (listeCalques) S.forEach(function (s) {
    var li = el("li", "", listeCalques), b = el("button", "", li);
    b.type = "button";
    b.innerHTML = '<i></i><span></span><small></small>';
    b.style.setProperty("--c", s.couleur);
    b.children[1].textContent = s.titre;
    b.children[2].textContent = tc(s.debut, true);
    b.addEventListener("click", function () { fermerFeuille(); allerScene(s); });
    calques.push(b);
  });
  var figures = [];
  var bac = $("[data-bac]");
  if (bac) {
    var vus = {};
    S.forEach(function (s) {
      [s.plan, s.plan2].forEach(function (plan) {
        if (!plan || vus[plan]) return;
        vus[plan] = true;
        var f = el("button", "st-media", bac);
        f.type = "button"; f.dataset.plan = plan;
        f.innerHTML = '<span class="st-vignette"><img alt="" loading="lazy" decoding="async"><span>00:06</span></span><span class="st-media-nom"></span>';
        f.querySelector("img").src = MEDIA + plan + ".jpg";
        f.querySelector(".st-media-nom").textContent = plan + "_rush.mov";
        f.setAttribute("aria-label", "Aller au premier plan « " + plan + " »");
        f.addEventListener("click", function () { for (var i = 0; i < S.length; i++) if (S[i].plan === plan || S[i].plan2 === plan) { allerScene(S[i]); break; } });
        figures.push(f);
      });
    });
  }
  var cartes = $$("[data-pour]").map(function (c) { return { el: c, pour: c.getAttribute("data-pour").split(/\s+/) }; });
  var props = {};
  $$("[data-prop]").forEach(function (p) { props[p.getAttribute("data-prop")] = { ligne: p, val: $("b", p) }; });
  function prop(nom, valeur, cle) {
    var p = props[nom];
    if (!p) return;
    if (p.val.textContent !== valeur) p.val.textContent = valeur;
    p.ligne.classList.toggle("cle", !!cle);
  }
  var tcs = $$("[data-tc]"), nomScene = $$("[data-nom-scene]"), totalEl = $$("[data-total-tc]");
  totalEl.forEach(function (e) { e.textContent = tc(TOTAL); });
  var pastille = $("[data-pastille]");

  /* Changement de scène */
  var courante = -1, coupeA = -1e9, sousGroupe = -1;
  function changer(i) {
    var avant = courante;
    courante = i;
    var s = S[i];
    S.forEach(function (x) { x.el.classList.toggle("on", x.i === i); x.el.setAttribute("aria-hidden", x.i === i ? "false" : "true"); });
    calques.forEach(function (b, j) { b.setAttribute("aria-current", j === i ? "true" : "false"); });
    clipsT.forEach(function (c, j) { c.classList.toggle("actif", j === i); });
    figures.forEach(function (f) { f.classList.toggle("actif", f.dataset.plan === s.plan || f.dataset.plan === s.plan2); });
    var n = 0;
    cartes.forEach(function (c) { var vis = c.pour.indexOf("*") >= 0 || c.pour.indexOf(s.id) >= 0; c.el.hidden = !vis; if (vis && c.pour.indexOf("*") < 0) n++; });
    if (pastille) pastille.hidden = n === 0;
    comp.setAttribute("data-voile", s.el.getAttribute("data-voile") || "");
    comp.classList.toggle("sans-reel", s.pose[4] < .05);
    comp.classList.toggle("reel-fond", s.pose[4] < .6);
    nomScene.forEach(function (e) { e.textContent = s.titre; });
    if (poster) poster.src = MEDIA + s.plan + ".jpg";
    if (s.volet) {
      var etiq = (s.el.getAttribute("data-volet") || "Après|Brut").split("|");
      $$(".st-volet-etiq", comp).forEach(function (e, j) { e.textContent = etiq[j] || ""; });
    }
    sousGroupe = -1;
    if (sousEl) sousEl.innerHTML = "";
    if (avant >= 0 && !reduit) {
      coupeA = performance.now();
      if (flash) { flash.classList.remove("go"); void flash.offsetWidth; flash.classList.add("go"); }
      comp.classList.remove("secoue"); void comp.offsetWidth; comp.classList.add("secoue");
    }
    var aCharger = [s.plan, s.plan2, S[i + 1] && S[i + 1].plan].filter(Boolean);
    aCharger.forEach(video);
    jouer([s.plan, s.plan2]);
    if (feuilleMode === "details") remplirFeuille("details");
  }

  /* Image par image */
  var tCourant = 0, dernierInstant = 0, horloge = 0, yImpose = -1;
  function image(instant) {
    requestAnimationFrame(image);
    // Lenis 1.3 n'a pas de boucle propre (autoRaf désactivé) : il avance ici, avant la lecture de la position.
    if (lenis) lenis.raf(instant);
    var dt = dernierInstant ? Math.min(.1, (instant - dernierInstant) / 1000) : 0;
    dernierInstant = instant; horloge += dt;
    // Un défilement venu d'ailleurs (doigt, molette, script, clavier) reprend la main sur la lecture.
    if (lecture && yImpose >= 0 && Math.abs(window.scrollY - yImpose) > 3) arreter();
    if (lecture) {
      tLecture += dt * vitesse;
      if (tLecture >= finLecture) { tLecture = finLecture; arreter(); }
      yImpose = Math.round(tLecture * pps);
      defilerImmediat(yImpose);
      tCourant = tLecture;
    } else if (gel) {
      tCourant = tGel;
    } else {
      tCourant = borne(window.scrollY / pps, 0, TOTAL - .001);
    }
    var i = sceneA(tCourant), s = S[i];
    if (i !== courante) changer(i);
    var p = borne((tCourant - s.debut) / s.duree, 0, 1);

    s.ks.forEach(function (k) {
      var v = borne((p - k.a) / (k.b - k.a), 0, 1);
      if (Math.abs(v - k.v) < .002) return;
      k.v = v;
      var e = sortie(v);
      k.el.style.setProperty("--k", e.toFixed(3));
      if (k.mots) {
        var nb = k.mots.length;
        k.mots.forEach(function (m, j) { m.style.setProperty("--k", borne(v * (nb + 2) - j, 0, 1).toFixed(3)); });
      }
      if (k.compte) {
        var txt = chiffre(k.compte.de + (k.compte.a - k.compte.de) * e, k.compte.format);
        if (k.el.textContent !== txt) k.el.textContent = txt;
      }
    });
    var fondu = s.i === S.length - 1 ? 1 : borne((1 - p) / .07, 0, 1);
    s.el.style.setProperty("--o", fondu.toFixed(3));

    // Calque Reel : position, échelle, rotation, opacité interpolées depuis la scène précédente
    var prec = S[i - 1] || s, ePose = reduit ? 1 : sortie(borne(p / .22, 0, 1));
    var pz = s.pose.map(function (v, j) { return prec.pose[j] + (v - prec.pose[j]) * ePose; });
    if (reel) {
      if (mqMobile.matches) { reel.style.transform = ""; reel.style.opacity = ""; }
      else {
        var W = comp.clientWidth, H = comp.clientHeight, sc = pz[2] / .9;
        reel.style.transform = "translate3d(" + (pz[0] / 100 * W).toFixed(1) + "px," + (pz[1] / 100 * H).toFixed(1) + "px,0) translate(-50%,-50%) scale(" + sc.toFixed(4) + ") rotate(" + pz[3].toFixed(2) + "deg)";
        reel.style.opacity = pz[4].toFixed(3);
      }
    }
    var coupe = reduit ? 0 : borne(1 - (instant - coupeA) / 260, 0, 1);
    var volet = -1;
    if (s.volet) volet = voletMain >= 0 ? voletMain : .9 - .8 * doux(borne((p - .12) / .55, 0, 1));
    if (reel) reel.style.setProperty("--volet", (volet < 0 ? 50 : volet * 100).toFixed(2) + "%");
    dessiner(s, p, coupe, horloge, volet);

    // Sous-titres du Reel, groupe par groupe, mot par mot
    if (sousEl && s.sous) {
      var q = borne((p - .04) / .82, 0, .9999), g = Math.floor(q * s.sous.length), mots = s.sous[g];
      if (g !== sousGroupe) {
        sousGroupe = g;
        sousEl.classList.remove("neuf"); void sousEl.offsetWidth; sousEl.classList.add("neuf");
        sousEl.innerHTML = "";
        mots.forEach(function (m, j) { var sp = el("span", "", sousEl); sp.textContent = m; if (j < mots.length - 1) sousEl.appendChild(document.createTextNode(" ")); });
      }
      var w = Math.floor((q * s.sous.length - g) * (mots.length + .6));
      $$("span", sousEl).forEach(function (sp, j) { sp.className = j === Math.min(w, mots.length - 1) ? "actif" : ""; });
    }

    // Inspecteur
    if (!mqMobile.matches && props.position) {
      var anime = p < .22 && i > 0;
      prop("position", Math.round(pz[0] / 100 * 1920) + ", " + Math.round(pz[1] / 100 * 1080), anime);
      prop("echelle", (pz[2] / .9 * 100).toFixed(1).replace(".", ",") + " %", anime);
      prop("rotation", pz[3].toFixed(1).replace(".", ",") + "°", anime && prec.pose[3] !== s.pose[3]);
      prop("opacite", Math.round(pz[4] * 100) + " %", anime && prec.pose[4] !== s.pose[4]);
      var etal = s.etal[0] + (s.etal[1] - s.etal[0]) * doux(borne((p - .08) / .6, 0, 1));
      prop("etalonnage", s.volet ? "Comparaison" : etal < .02 ? "Brut (log)" : "LUT Cut · " + Math.round(etal * 100) + " %", s.etal[0] !== s.etal[1] && p < .7);
      prop("coupe", coupe > 0 ? "Glitch · " + coupe.toFixed(2).replace(".", ",") : "Aucune", coupe > 0);
      prop("entree", tc(s.debut) + " → " + tc(s.fin));
    }

    // Timecodes, tête de lecture, zone jouée
    var code = tc(tCourant);
    tcs.forEach(function (e) { if (e.textContent !== code) e.textContent = code; });
    if (rail) {
      var frac = tCourant / TOTAL;
      if (mqMobile.matches) {
        rail.style.width = (TOTAL * PPS_TL) + "px";
        rail.style.transform = "translate3d(" + (vue.clientWidth / 2 - tCourant * PPS_TL).toFixed(1) + "px,0,0)";
        tete.style.left = "";
      } else {
        rail.style.width = ""; rail.style.transform = "";
        tete.style.left = (frac * 100).toFixed(3) + "%";
      }
      joue.style.width = (frac * 100).toFixed(3) + "%";
    }
    studio.style.setProperty("--avance", (tCourant / TOTAL).toFixed(4));
  }

  /* Comparaison : la poignée suit le doigt ou la souris sur le Reel */
  var voletMain = -1;
  if (reel) {
    var tenu = false;
    var suivre = function (ev) {
      var r = reel.getBoundingClientRect();
      voletMain = borne((ev.clientX - r.left) / r.width, .02, .98);
    };
    reel.addEventListener("pointerdown", function (ev) { if (!S[courante] || !S[courante].volet) return; tenu = true; suivre(ev); try { reel.setPointerCapture(ev.pointerId); } catch (e) {} });
    reel.addEventListener("pointermove", function (ev) { if (tenu || (ev.pointerType === "mouse" && S[courante] && S[courante].volet)) suivre(ev); });
    reel.addEventListener("pointerup", function () { tenu = false; });
    reel.addEventListener("pointerleave", function () { if (!tenu) voletMain = -1; });
  }

  /* Repos : arrêté au milieu d'une construction, la lecture finit la scène jusqu'à son point d'arrêt */
  var minuteurRepos = 0;
  function attente() {
    clearTimeout(minuteurRepos);
    minuteurRepos = setTimeout(function () {
      if (lecture || gel || reduit || feuilleMode || fenetreOuverte || sens < 0) return;
      var vise = borne((lenis ? lenis.targetScroll : window.scrollY) / pps, 0, TOTAL - .001), s = S[sceneA(vise)];
      var p = (vise - s.debut) / s.duree;
      if (p > .01 && p < s.maintien - .02) lire(s.debut + s.duree * s.maintien, 2.2);
    }, 260);
  }
  var dernierY = 0, sens = 1;
  window.addEventListener("scroll", function () {
    var y = window.scrollY;
    if (y !== dernierY) sens = y > dernierY ? 1 : -1;
    dernierY = y;
    if (!lecture) attente();
  }, { passive: true });

  /* Commandes : lecture, scènes précédente / suivante, clavier */
  $$("[data-lecture]").forEach(function (b) {
    b.addEventListener("click", function () {
      if (lecture) { arreter(); return; }
      if (tCourant >= TOTAL - .05) { aller(0, false); tCourant = 0; }
      lire();
    });
  });
  $$("[data-scene-prec]").forEach(function (b) { b.addEventListener("click", function () { arreter(); allerScene(S[Math.max(0, courante - (tCourant - S[courante].debut > 1 ? 0 : 1))]); }); });
  $$("[data-scene-suiv]").forEach(function (b) { b.addEventListener("click", function () { arreter(); allerScene(S[Math.min(S.length - 1, courante + 1)]); }); });
  $$("[data-debut]").forEach(function (b) { b.addEventListener("click", function () { arreter(); aller(0, true); }); });
  $$("[data-aller]").forEach(function (a) {
    a.addEventListener("click", function (ev) {
      var s = parId(a.getAttribute("data-aller"));
      if (!s) return;
      ev.preventDefault(); arreter(); fermerFeuille(); fermerFenetre(); allerScene(s);
    });
  });
  document.addEventListener("keydown", function (ev) {
    var cible = ev.target, saisie = /^(INPUT|TEXTAREA|SELECT)$/.test(cible.tagName) || cible.isContentEditable;
    if (ev.key === "Escape") { fermerFenetre(); fermerFeuille(); return; }
    if (saisie || fenetreOuverte || feuilleMode || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    if (ev.key === " " && cible.tagName !== "BUTTON" && cible.tagName !== "A" && cible.tagName !== "SUMMARY") { ev.preventDefault(); if (lecture) arreter(); else lire(); }
    else if (ev.key === "ArrowRight" || ev.key === "ArrowDown" || ev.key === "PageDown") { ev.preventDefault(); arreter(); allerScene(S[Math.min(S.length - 1, courante + 1)]); }
    else if (ev.key === "ArrowLeft" || ev.key === "ArrowUp" || ev.key === "PageUp") { ev.preventDefault(); arreter(); allerScene(S[Math.max(0, courante - 1)]); }
    else if (ev.key === "Home") { ev.preventDefault(); arreter(); aller(0, true); }
    else if (ev.key === "End") { ev.preventDefault(); arreter(); allerScene(S[S.length - 1]); }
  });

  /* Fenêtre d'export (le bouton principal de la page) */
  var fenetre = $("[data-st-fenetre]"), fenetreOuverte = false, ouvreur = null;
  function ouvrirFenetre(depuis) {
    if (!fenetre) return;
    ouvreur = depuis || document.activeElement;
    fermerFeuille();
    arreter();
    fenetre.hidden = false; fenetreOuverte = true;
    document.documentElement.classList.add("st-modal");
    if (lenis) lenis.stop();
    var champ = mqMobile.matches ? $("[data-fermer]", fenetre) : $("input:not([type=hidden]):not([tabindex='-1']), button", $(".st-fenetre-corps", fenetre));
    setTimeout(function () { if (champ) champ.focus({ preventScroll: true }); }, 60);
    rendu(0);
  }
  function fermerFenetre() {
    if (!fenetre || !fenetreOuverte) return;
    if (fenetre.hasAttribute("data-fixe")) return;
    fenetre.hidden = true; fenetreOuverte = false;
    document.documentElement.classList.remove("st-modal");
    if (lenis) lenis.start();
    if (ouvreur && ouvreur.focus) ouvreur.focus({ preventScroll: true });
  }
  var barreRendu = fenetre && $("[data-rendu]", fenetre), minuteurRendu = 0;
  function rendu(v) {
    if (!barreRendu) return;
    cancelAnimationFrame(minuteurRendu);
    var t0 = performance.now();
    (function pas(n) {
      var x = reduit ? 1 : borne((n - t0) / 1400, 0, 1);
      barreRendu.style.setProperty("--k", doux(x).toFixed(3));
      var pct = $("[data-rendu-pct]", fenetre);
      if (pct) pct.textContent = Math.round(doux(x) * 100) + " %";
      if (x < 1) minuteurRendu = requestAnimationFrame(pas);
    })(t0);
  }
  $$("[data-export]").forEach(function (b) {
    b.addEventListener("click", function (ev) {
      if (!fenetre) return;
      ev.preventDefault();
      ouvrirFenetre(b);
    });
  });
  if (fenetre) {
    fenetre.addEventListener("click", function (ev) { if (ev.target === fenetre) fermerFenetre(); });
    $$("[data-fermer]", fenetre).forEach(function (b) { b.addEventListener("click", fermerFenetre); });
    if (fenetre.hasAttribute("data-ouverte")) { fenetre.hidden = false; fenetreOuverte = true; document.documentElement.classList.add("st-modal"); }
  }

  /* Feuilles mobiles (CapCut) : scènes, détails de la scène, infos. Les nœuds sont déplacés, jamais copiés. */
  var feuille = $("[data-feuille]"), fondFeuille = $("[data-feuille-fond]"), feuilleMode = "", deplaces = [];
  var titresFeuille = { scenes: "Scènes", details: "Détails de la scène", infos: "Infos" };
  function deplacer(noeud, cible) {
    if (!noeud) return;
    var repere = document.createComment("place");
    noeud.parentNode.insertBefore(repere, noeud);
    deplaces.push({ noeud: noeud, repere: repere });
    cible.appendChild(noeud);
  }
  function remettre() {
    deplaces.forEach(function (d) { d.repere.parentNode.insertBefore(d.noeud, d.repere); d.repere.remove(); });
    deplaces = [];
  }
  function remplirFeuille(mode) {
    var corps = $(".st-feuille-corps", feuille);
    remettre();
    corps.innerHTML = "";
    $(".st-feuille-titre", feuille).textContent = mode === "details" && S[courante] ? S[courante].titre : titresFeuille[mode] || "";
    if (mode === "scenes") deplacer(listeCalques, corps);
    if (mode === "details") {
      deplacer($("[data-cartes]"), corps);
      if (!cartes.some(function (c) { return !c.el.hidden; })) el("p", "st-vide", corps, "Tout est à l'écran pour cette scène.");
    }
    if (mode === "infos") deplacer($("[data-infos]"), corps);
  }
  function ouvrirFeuille(mode, depuis) {
    if (!feuille) return;
    arreter();
    feuilleMode = mode;
    remplirFeuille(mode);
    feuille.hidden = false; fondFeuille.hidden = false;
    requestAnimationFrame(function () { feuille.classList.add("ouverte"); fondFeuille.classList.add("ouverte"); });
    if (lenis) lenis.stop();
    ouvreur = depuis || null;
    setTimeout(function () { var f = $("button, a, summary, input", feuille); if (f) f.focus({ preventScroll: true }); }, 80);
  }
  function fermerFeuille() {
    if (!feuille || !feuilleMode) return;
    feuilleMode = "";
    feuille.classList.remove("ouverte"); fondFeuille.classList.remove("ouverte");
    setTimeout(function () { if (!feuilleMode) { feuille.hidden = true; fondFeuille.hidden = true; remettre(); } }, 380);
    if (lenis && !fenetreOuverte) lenis.start();
    if (ouvreur && ouvreur.focus) ouvreur.focus({ preventScroll: true });
  }
  $$("[data-feuille-ouvre]").forEach(function (b) {
    b.addEventListener("click", function () {
      var mode = b.getAttribute("data-feuille-ouvre");
      if (feuilleMode === mode) { fermerFeuille(); return; }
      var cible = b.getAttribute("data-vers");
      if (cible && parId(cible)) { allerScene(parId(cible), false); setTimeout(function () { ouvrirFeuille(mode, b); }, 30); return; }
      ouvrirFeuille(mode, b);
    });
  });
  if (fondFeuille) fondFeuille.addEventListener("click", fermerFeuille);
  if (feuille) $$("[data-feuille-ferme]", feuille).forEach(function (b) { b.addEventListener("click", fermerFeuille); });
  mqMobile.addEventListener && mqMobile.addEventListener("change", function () { fermerFeuille(); mesurer(true); });

  /* Liste d'attente : le questionnaire (formulaire.js) prend la main après l'inscription */
  var sheet = document.getElementById("sheet");
  function etiquetteInscrit() {
    var mail = "";
    try { mail = (JSON.parse(localStorage.getItem("ecs_cut_v1")) || {}).email || ""; } catch (e) {}
    if (!mail) return;
    $$("[data-export-libelle]").forEach(function (e) { e.textContent = e.getAttribute("data-export-libelle"); });
  }
  if (sheet && window.MutationObserver) new MutationObserver(function () { if (!sheet.hidden) { fermerFenetre(); fermerFeuille(); etiquetteInscrit(); } }).observe(sheet, { attributes: true, attributeFilter: ["hidden"] });
  etiquetteInscrit();

  /* Compte à rebours (mêmes règles que la v1) */
  var blocs = $$("[data-decompte]");
  if (blocs.length) {
    var attr = function (b, n, d) { var v = b.getAttribute(n); return v === null ? d : v; };
    var majDecompte = function () {
      blocs.forEach(function (b) {
        var cible = Date.parse(attr(b, "data-cible", "2026-10-30T18:00:00+04:00"));
        var fen = +attr(b, "data-fenetre", 8) * 86400000, reste = cible - Date.now(), lab, html;
        if (reste <= 0) { lab = attr(b, "data-fin-label", "C'est ouvert"); html = attr(b, "data-fin", '<a href="/cut/vente-v2">Découvrir Cut →</a>'); }
        else if (reste > fen) { lab = attr(b, "data-attente-label", "Ouverture"); html = attr(b, "data-attente", "fin octobre"); }
        else {
          var s = Math.floor(reste / 1000);
          lab = attr(b, "data-label", "Ouverture dans");
          html = deux(Math.floor(s / 86400)) + "<small>j</small>" + deux(Math.floor(s % 86400 / 3600)) + "<small>h</small>" + deux(Math.floor(s % 3600 / 60)) + "<small>min</small>" + deux(s % 60) + "<small>s</small>";
        }
        var t = $(".tcode", b), l = $(".cut-tc", b);
        if (t && t.innerHTML !== html) t.innerHTML = html;
        if (l && l.textContent !== lab) l.textContent = lab;
      });
    };
    majDecompte();
    setInterval(majDecompte, 1000);
  }

  /* Simulateur : (temps d'aujourd'hui − 15 min par Reel) × Reels par semaine × 4 semaines */
  var simu = $("[data-simu]");
  if (simu) (function () {
    var rn = $("#r-n", simu), rt = $("#r-t", simu), o = {}, b = {}, affiche = -1, cible = 0, boucle = 0;
    $$("[data-o]", simu).forEach(function (e) { o[e.getAttribute("data-o")] = e; });
    $$("[data-b]", simu).forEach(function (e) { b[e.getAttribute("data-b")] = e; });
    function duree(h) { var tot = Math.round(h * 60), hh = Math.floor(tot / 60), mm = tot % 60; return hh ? hh + "\u202fh" + (mm ? "\u202f" + deux(mm) : "") : mm + "\u202fmin"; }
    function compte() {
      affiche = affiche < 0 || reduit ? cible : affiche + (cible - affiche) * .18;
      if (Math.abs(cible - affiche) < .5) affiche = cible;
      o.gagne.textContent = "≈ " + Math.round(affiche) + " h";
      boucle = affiche === cible ? 0 : requestAnimationFrame(compte);
    }
    function maj() {
      var n = +rn.value, t = +rt.value, avant = n * t, apres = n * .25;
      [rn, rt].forEach(function (r) { r.style.setProperty("--p", ((r.value - r.min) / (r.max - r.min) * 100) + "%"); });
      o.n.textContent = n; o.t.textContent = duree(t);
      o.avant.textContent = duree(avant) + " / sem."; o.apres.textContent = duree(apres) + " / sem.";
      b.apres.style.setProperty("--w", Math.max(2, apres / avant * 100) + "%");
      cible = Math.round(Math.max(0, (avant - apres) * 4));
      if (!boucle) boucle = requestAnimationFrame(compte);
    }
    rn.addEventListener("input", maj); rt.addEventListener("input", maj);
    maj();
  })();

  /* Démarrage */
  demarrerLenis();
  mesurer(true);
  window.addEventListener("resize", function () { mesurer(false); });
  window.addEventListener("load", function () { demarrerLenis(); mesurer(true); });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) Object.keys(videos).forEach(function (k) { videos[k].pause(); });
    else if (S[courante]) jouer([S[courante].plan, S[courante].plan2]);
  });
  tCourant = borne(window.scrollY / pps, 0, TOTAL - .001);
  studio.classList.add("pret");
  requestAnimationFrame(image);
  // Intro : à l'ouverture, la séquence se lit jusqu'au point d'arrêt de la première scène
  if (fenetre && fenetre.hasAttribute("data-ouverte")) aller(S[0].duree * S[0].maintien, false);
  else if (window.scrollY < 2) {
    if (reduit) aller(S[0].duree * S[0].maintien, false);
    else setTimeout(function () { if (window.scrollY < 2) lire(S[0].debut + S[0].duree * S[0].maintien, 1.7); }, 250);
  }
})();
