# Template Prompt — Page d'Optin High-Converting

Copie-colle ce prompt dans Claude Code pour générer une page d'optin complète. Remplace les variables entre `{{...}}` par tes infos.

---

## LE PROMPT

```
Crée une page d'optin single-page HTML (tout en un fichier) pour {{NOM_DU_PROJET}}.

## INFOS PROJET
- Nom : {{NOM_DU_PROJET}}
- URL du logo : {{URL_LOGO}}
- URL du favicon : {{URL_FAVICON}}
- Couleur accent : {{COULEUR_HEX}} (ex: #FF9D00)
- Domaine : {{DOMAINE}} (ex: go.monsite.com)
- URL de redirection après optin : {{URL_REDIRECT}} (ex: https://www.skool.com/...)
- Nombre de membres/clients : {{NOMBRE}} (ex: 1 338)
- Note Trustpilot/avis : {{NOTE}} (ex: 5.0)

## COPYWRITING
- Headline H1 : {{HEADLINE}}
- Sous-titre : {{SOUS_TITRE}}
- Bullets (3 points clés) : {{BULLET_1}}, {{BULLET_2}}, {{BULLET_3}}
- Texte bouton CTA : {{CTA_TEXT}} (ex: "OBTENIR MON ACCÈS GRATUIT →")
- Titre VSL thumbnail : {{VSL_HOOK}}
- Durée VSL : {{DUREE}} min

## INTÉGRATION GHL
- Location ID : {{GHL_LOCATION_ID}}
- API Key : {{GHL_API_KEY}}
- Pipeline ID : {{GHL_PIPELINE_ID}}
- Stage ID : {{GHL_STAGE_ID}}
- Tag : {{GHL_TAG}}
- Source : {{GHL_SOURCE}}

## SENJA (témoignages)
- Widget ID #1 (sous VSL) : {{SENJA_ID_1}}
- Widget ID #2 (bas de page) : {{SENJA_ID_2}}

## STRUCTURE DE LA PAGE (dans cet ordre)

### 1. HEAD
- Meta SEO : title, description, og:title, og:description, og:image, twitter:card
- PWA meta : apple-mobile-web-app-capable, theme-color, viewport-fit:cover
- Favicon + apple-touch-icon
- Manifest.json
- Preconnect + preload Google Fonts
- Font : Plus Jakarta Sans (400-800)

### 2. DESIGN SYSTEM (CSS variables)
- Palette : fond clair, fond dark (bruns chauds, PAS des noirs froids), accent, cards
- Noise texture SVG en overlay sur body (opacity 7%, fractalNoise)
- ::selection en couleur accent
- Curseur custom SVG en couleur accent
- Curseur CTA avec animation pulsante (cercle SVG animé)
- Scroll progress bar fixe en haut (gradient accent)

### 3. HERO
- Badge live pulsant ("X inscrits cette semaine") au-dessus du H1
- H1 avec accent coloré sur la phrase clé
- Sous-titre (max 2 lignes)
- 3 bullets avec checkmarks accent
- Dots et croix décoratifs flottants (opacity ~0.4-0.6, animation float 6-9s)
- Light beams verticaux animés tombants (gradient blanc→accent, 8-12s)
- Dot-grid en background (radial-gradient, 28px spacing)
- Animations fadeUp avec blur (cubic-bezier(.525,0,0,1))

### 4. VSL PLAYER
- Conteneur max-width 960px, border-radius 16px
- Thumbnail dark avec hook text, bouton play accent pulsant
- Shadows multi-couches premium

### 5. CTA SOUS VSL
- Bouton pleine largeur sous la vidéo
- Reassurance en dessous : "Gratuit · Pas de carte bancaire · Accès immédiat" (texte noir)
- Proof bar avec avatar group + texte défilant (roller animation)
  Mots qui défilent en accent : entrepreneurs, coachs, freelances, etc.

### 6. SENJA #1
- Widget Senja sous le CTA, max-width 1100px

### 7. DARK ZONE (fond dark chaud)
- Grid lines texture en background (opacity 2%)
- Orbes radial-gradient subtils

#### 7a. Compteurs animés
- 3 colonnes : chiffre accent animé (count-up au scroll, easeOutExpo)
- Badge rating Trustpilot

#### 7b. Bento Grid
- 3 colonnes desktop, 1 colonne mobile
- Numéro d'étape (01-06) avec badge accent
- Emoji + titre + description
- Hover : glow line en haut, numéro devient accent plein, icône scale+rotate
- Mouse-follow ambient glow (CSS custom properties --mx --my)
- Stagger reveal au scroll (transition-delay 0.05s incrémental)
- Mobile : état hover activé automatiquement au scroll (IntersectionObserver 60%)

#### 7c. CTA mid-funnel
- Bouton + reassurance

#### 7d. FAQ
- Cards individuelles avec background, border-radius, gap
- Arrow dans un carré qui devient accent au open
- Expand/collapse avec opacity + max-height transition
- 3-4 questions répondant aux objections principales

#### 7e. Urgency / Countdown
- Countdown temps réel vers le prochain événement (calcul JS dynamique)
- 4 blocs (Jours/Heures/Min/Sec) avec fond accent subtil
- Séparateurs ":" pulsants
- Bordure accent + ligne lumineuse en haut

#### 7f. CTA final (card)
- Titre + sous-titre + bouton + reassurance

### 8. SENJA #2
- Titre "Ce qu'ils en disent."
- Widget Senja, propre section, PAS dans un conteneur overflow:hidden

### 9. BIG CTA SECTION (fond accent plein)
- Grille de lignes blanches en background (48px, opacity 7%)
- Noise grain SVG en overlay (mix-blend-mode overlay)
- Glow radial blanc en haut
- Titre + sous-titre + bouton inversé (fond blanc, texte accent)

### 10. FOOTER
- Fond blanc
- Logo pleine opacité
- Liens : Politique de confidentialité, CGV, Mentions légales
- Copyright
- Disclaimer Facebook

## POPUPS & OVERLAYS

### Modal d'optin (s'ouvre au clic sur tous les CTA)
- Header dark : avatar group + compteur membres + titre + sous-titre
- Flèche CSS triangle entre header et body
- Body fond blanc : formulaire (prénom, nom, email, téléphone)
- Floating labels animés (placeholder transparent, label qui monte au focus)
- Micro-copie sous le bouton : "Tu recevras ton accès en moins de 30 secondes"
- Reassurance en dessous
- Preuve sociale dynamique dans le header ("Thomas vient de s'inscrire il y a 2 min")
- Close : overlay click, bouton X, touche Escape
- Focus trap clavier (Tab/Shift+Tab)
- Body overflow hidden quand ouvert
- Mobile : slide-up depuis le bas (sheet style, border-radius haut)

### Exit intent popup (desktop uniquement)
- Détection mouseout Y<5, une seule fois par session
- Header dark avec emoji + titre + sous-titre
- Flèche CSS triangle
- Body blanc avec 3 stats en accent (Membres, CA généré, Note)
- Bouton CTA → ouvre le modal d'optin

### Fullscreen loader (après soumission)
- Spinner accent + barre de progression animée (30% → 60% → 85% → 100%)
- Messages : "Inscription en cours..." → "✓ Inscription confirmée !"
- Redirection vers URL_REDIRECT après 2.8s

## NOTIFICATIONS SOCIALES
- Bulle fixe en bas à gauche (desktop) / en haut (mobile)
- Barre flamme accent sur le bord gauche (gradient + glow pulsant)
- Photo de profil (pravatar.cc) + texte + emoji feu dans le timestamp
- 15 prénoms français qui cyclent sans répétition
- 5 templates de messages différents
- Affichage 8 secondes, intervalle 12 secondes, début après 5s
- Slide-in/out avec cubic-bezier

## CTA STICKY MOBILE
- Fixe en bas, backdrop-filter blur, bordure accent subtile
- Bouton + reassurance compacte
- safe-area-inset-bottom pour iPhone
- Apparait quand le CTA principal n'est plus visible (IntersectionObserver)

## EFFETS INTERACTIFS
- Particules flammes/étoiles au hover sur les CTA (🔥 ✨ ⚡ 💥 🌟, spawn toutes les 120ms)
- Explosion confettis au clic (24 confettis + 12 sparks, directions aléatoires)
- Reveal au scroll avec blur-to-sharp (opacity + translateY + filter:blur)
- Stagger delays sur les grids
- GPU acceleration (will-change, backface-visibility)

## INTÉGRATION API GHL
- Upsert contact (prénom, nom, email, tel, source, tag)
- Créer opportunité (pipeline, stage, nom = Prénom Nom)
- Fallback : rediriger même si l'API échoue
- CORS direct (GHL autorise access-control-allow-origin: *)

## RESPONSIVE MOBILE (max-width: 640px)
- Scroll progress bar masquée
- Decorative elements masqués (dots, croix, rings, light beams)
- Counter en 3 colonnes compact
- Bento en 1 colonne avec scroll-active (hover auto au scroll)
- Modal en sheet bottom (slide-up, border-radius haut)
- Notifications en haut de l'écran
- Sticky CTA avec safe-area
- Body padding-bottom pour le sticky
- Tailles de texte adaptées (clamp)

## PAGES LÉGALES
- Créer politique-de-confidentialite.html, cgv.html, mentions-legales.html
- Même design (fond dark, texte clair, accent orange, max-width 800px)
- Lien retour vers index.html
- Adapter le domaine partout
```

---

## CHECKLIST APRÈS GÉNÉRATION

- [ ] Remplacer l'URL VSL (about:blank → vraie URL)
- [ ] Tester le formulaire (vérifier contact + opportunité dans GHL)
- [ ] Vérifier les widgets Senja (chargement correct)
- [ ] Tester l'exit intent popup (desktop)
- [ ] Tester le sticky CTA (mobile)
- [ ] Tester les notifications (timing, photos, textes)
- [ ] Vérifier le countdown (prochain événement correct)
- [ ] Tester la redirection post-optin
- [ ] Vérifier meta OG (partage WhatsApp/Facebook)
- [ ] Tester le responsive (iPhone, Android)
- [ ] Vérifier les pages légales (liens fonctionnels)
