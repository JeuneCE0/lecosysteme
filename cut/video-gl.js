/* Cut : rendu des plans vidéo en WebGL2 (étalonnage, grain, glitch de coupe, volet avant/après).
   CutVideo.creer(canvas, { face: "/cut/media/face.mp4", … }) → { rendre(etat), lancer(), pause(), pret, gl }.
   etat = { plan, zoom, x, y, sat, etalonnage, coupe (0-1), grain, volet (0-1, -1 = aucun), temps }.
   Sans WebGL2 : repli en Canvas 2D (mêmes cadrages, sans effets). */
(function () {
  var VS = "#version 300 es\nin vec2 p;out vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}";
  var FS = [
    "#version 300 es",
    "precision highp float;",
    "in vec2 v;out vec4 o;",
    "uniform sampler2D t;uniform vec2 ts,vs,pan;uniform float zoom,sat,grade,cut,grain,tm,wipe;",
    "float h(vec2 q){return fract(sin(dot(q,vec2(12.9898,78.233)))*43758.5453);}",
    "vec2 couv(vec2 q){float ra=vs.x/vs.y,rt=ts.x/ts.y;vec2 s=ra>rt?vec2(1.,rt/ra):vec2(ra/rt,1.);return (q-.5)*s/zoom+.5+pan;}",
    "vec3 lire(vec2 q){float a=.007*cut;vec2 u=couv(q);return vec3(texture(t,u+vec2(a,0.)).r,texture(t,u).g,texture(t,u-vec2(a,0.)).b);}",
    "vec3 etal(vec3 c,float g,float s){float l=dot(c,vec3(.299,.587,.114));c=mix(vec3(l),c,s);",
    " vec3 w=c*vec3(1.07,1.,.92);w=w*w*(3.-2.*w);w=mix(w,w*vec3(1.,.97,.9)+vec3(.02,.01,0.),.5);return mix(c,clamp(w*1.04,0.,1.),g);}",
    "void main(){vec2 q=v;",
    " if(cut>0.){float b=floor(q.y*22.);q.x+=(h(vec2(b,floor(tm*24.)))-.5)*.14*cut;}",
    " vec3 c=lire(q);",
    " if(wipe>=0.){float m=smoothstep(wipe-.002,wipe+.002,v.x);vec3 brut=etal(c,0.,.18)*.86;vec3 fin=etal(c,1.,1.12);c=mix(fin,brut,m);}",
    " else c=etal(c,grade,sat);",
    " float vg=smoothstep(1.15,.3,length((v-.5)*vec2(1.,1.25)));c*=mix(1.,vg,.5);",
    " c+=(h(v*vs+fract(tm*7.)*100.)-.5)*grain;",
    " c+=cut*.16;o=vec4(c,1.);}"
  ].join("\n");

  function shader(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }

  function creer(canvas, sources) {
    var videos = {}, textures = {}, gl = null, prog, loc = {}, ctx2d = null, actif = true;
    // Une source peut être une adresse ou une <video> déjà créée par un autre rendu (un seul décodage par plan).
    Object.keys(sources).forEach(function (cle) {
      if (typeof sources[cle] !== "string") { videos[cle] = sources[cle]; return; }
      var v = document.createElement("video");
      v.muted = true; v.loop = true; v.playsInline = true; v.preload = "auto";
      v.setAttribute("muted", ""); v.setAttribute("playsinline", ""); v.setAttribute("webkit-playsinline", "");
      // Les navigateurs sans H.264 (Chromium libre, certains Linux) reçoivent la version WebM (VP9) du même plan.
      var src = sources[cle];
      if (/\.mp4$/.test(src) && !v.canPlayType('video/mp4; codecs="avc1.640028"') && v.canPlayType('video/webm; codecs="vp9"')) src = src.replace(/\.mp4$/, ".webm");
      v.src = src;
      videos[cle] = v;
    });
    try {
      gl = canvas.getContext("webgl2", { alpha: false, antialias: false, powerPreference: "high-performance" });
      if (gl) {
        prog = gl.createProgram();
        gl.attachShader(prog, shader(gl, gl.VERTEX_SHADER, VS));
        gl.attachShader(prog, shader(gl, gl.FRAGMENT_SHADER, FS));
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
        gl.useProgram(prog);
        var buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        var p = gl.getAttribLocation(prog, "p");
        gl.enableVertexAttribArray(p); gl.vertexAttribPointer(p, 2, gl.FLOAT, false, 0, 0);
        ["t", "ts", "vs", "pan", "zoom", "sat", "grade", "cut", "grain", "tm", "wipe"].forEach(function (n) { loc[n] = gl.getUniformLocation(prog, n); });
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        Object.keys(videos).forEach(function (cle) {
          var tx = gl.createTexture();
          gl.bindTexture(gl.TEXTURE_2D, tx);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([20, 18, 14, 255]));
          textures[cle] = tx;
        });
        canvas.addEventListener("webglcontextlost", function (e) { e.preventDefault(); gl = null; ctx2d = canvas.getContext("2d"); });
      }
    } catch (e) { gl = null; }
    if (!gl) ctx2d = canvas.getContext("2d");

    function taille() {
      var r = canvas.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2);
      var w = Math.max(2, Math.round(r.width * d)), h = Math.max(2, Math.round(r.height * d));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    }

    function rendre(e) {
      if (!actif) return;
      taille();
      var v = videos[e.plan] || videos[Object.keys(videos)[0]];
      var pret = v.readyState >= 2;
      if (gl) {
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.bindTexture(gl.TEXTURE_2D, textures[e.plan]);
        if (pret) { try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, v); } catch (er) {} }
        gl.uniform1i(loc.t, 0);
        gl.uniform2f(loc.ts, v.videoWidth || 9, v.videoHeight || 16);
        gl.uniform2f(loc.vs, canvas.width, canvas.height);
        gl.uniform2f(loc.pan, e.x || 0, e.y || 0);
        gl.uniform1f(loc.zoom, e.zoom || 1);
        gl.uniform1f(loc.sat, e.sat === undefined ? 1 : e.sat);
        gl.uniform1f(loc.grade, e.etalonnage === undefined ? 1 : e.etalonnage);
        gl.uniform1f(loc.cut, e.coupe || 0);
        gl.uniform1f(loc.grain, e.grain === undefined ? .05 : e.grain);
        gl.uniform1f(loc.tm, e.temps || 0);
        gl.uniform1f(loc.wipe, e.volet === undefined ? -1 : e.volet);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      } else if (ctx2d && pret) {
        var cw = canvas.width, ch = canvas.height, vw = v.videoWidth, vh = v.videoHeight;
        var s = Math.max(cw / vw, ch / vh) * (e.zoom || 1);
        ctx2d.filter = "saturate(" + (e.sat === undefined ? 1 : e.sat) + ")";
        ctx2d.drawImage(v, (cw - vw * s) / 2 - (e.x || 0) * vw * s, (ch - vh * s) / 2 + (e.y || 0) * vh * s, vw * s, vh * s);
      }
    }

    return {
      gl: !!gl,
      videos: videos,
      rendre: rendre,
      lancer: function () { actif = true; Object.keys(videos).forEach(function (k) { var pr = videos[k].play(); if (pr && pr.catch) pr.catch(function () {}); }); },
      pause: function () { actif = false; Object.keys(videos).forEach(function (k) { videos[k].pause(); }); },
      pret: function () { return Object.keys(videos).every(function (k) { return videos[k].readyState >= 2; }); }
    };
  }

  /* Lueur ambiante : la vidéo, réduite et floutée, teinte la page autour de la fenêtre */
  function ambiance(source, cible) {
    var c = cible.getContext("2d"), n = 0;
    return function () { if ((n++ & 3) === 0) { try { c.drawImage(source, 0, 0, cible.width, cible.height); } catch (e) {} } };
  }

  window.CutVideo = { creer: creer, ambiance: ambiance };
})();
