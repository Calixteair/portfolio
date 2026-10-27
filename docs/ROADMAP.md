# Feuille de route

Un jalon = une ou plusieurs sessions Claude Code. Fais `/clear` entre deux jalons, pour que chaque session reparte d'un contexte propre (CLAUDE.md est rechargé automatiquement).
Coche les critères au fur et à mesure : ce fichier sert aussi de mémoire de l'avancement.

## M0 — Squelette du projet

- [x] Astro statique + île React + R3F + TypeScript strict, avec une scène vide qui s'affiche
- [x] `WebGPURenderer` dans R3F, repli WebGL 2 vérifié, un compute shader TSL minimal qui tourne
- [x] Vérifier la compatibilité WebGPU des composants drei prévus (résultats : SPEC §11)
- [x] Arborescence de la SPEC, scripts npm, ESLint et Prettier
- [x] Dockerfile + nginx.conf + docker-compose, testés en local (`docker compose up`)
- [x] Captures Playwright (script + e2e sur les deux backends). Le MCP Playwright n'est pas configuré : non bloquant
- [x] CI : lint, tests, build, budget, e2e WebGL 2, hadolint, gitleaks, dependency review, CodeQL, Dependabot groupé
- [x] CD : image GHCR (Trivy, SBOM, provenance, cosign) → `:prod` → déploiement SSH ForceCommand sur portfolio.calixteair.fr, smoke test
- [x] Budget JS initial : 450 Ko gzip (SPEC §7, 409 Ko mesurés en M0)

## M1 — Ambiance et placeholder

- [x] Placeholder procédural du pendentif (SPEC §6) : plaque, croûte (edgeMask), diamants
- [x] Environnement PMREM procédural (pas de HDRI, SPEC §5.1), éclairage infernal, post-traitement (bloom, AgX, aberration, grain, vignette)
- [x] Décor : pics sur plusieurs plans, sol rocheux, ciel étoilé et nuages, réaction à la chauffe (SPEC §5.1), au niveau du prototype
- [x] Rotation au clic et au glisser avec inertie, respiration coupée par `prefers-reduced-motion`
- [x] Panneau leva (dev seulement, absent du bundle de prod) pour régler lumières, effets et chauffe

## M2 — Loader

- [x] Fil incandescent en SVG/CSS (contour exact du pendentif), progression lissée par étapes réelles
- [x] Précompilation des shaders (`compileAsync`), bouton « Entrer », raccord avec le pendentif projeté à l'écran
- [x] Cas cache chaud, sans WebGPU ni WebGL, timeout, sans JavaScript : version classique minimale (complétée en M7)
- [ ] Audio débloqué par « Entrer » et bouton « Passer l'intro » : reportés (son en question ouverte, SPEC §10 ; portfolio en M6)

## M3 — Chauffe et étincelles

- [x] Machine à états en TypeScript pur + tests unitaires (Vitest), clics qui chauffent, seuils réglables (leva)
- [x] Shader de chauffe (corps noir, trou + bord extérieur, croûte, teintes de revenu)
- [x] Étincelles en compute shader : gravité, traînée, collisions SDF avec le pendentif en rotation (vitesse de surface transmise) et le sol
- [x] Particules de protomolécule qui sortent du trou (essaim, sans gravité, rampent sur la surface)
- [x] Repli WebGL 2 (même simulation, moitié moins de particules), distorsion de chaleur (masque d'émission en MRT), tremblement en surchauffe
- [ ] Collisions avec les rochers du décor : reportées (les étincelles retombent avant les rochers les plus proches, à 4,5 m)

## M4 — Portail

- [x] Render target du système planétaire (provisoire, palette B) en demi-résolution HDR, vu comme une fenêtre (caméra du portail liée à la vraie, parallaxe)
- [x] Lumière bleue qui déborde sur la croûte et les parois, étincelles qui se calment pendant l'ouverture
- [x] Ouverture animée depuis le centre, front irrégulier et bord incandescent

## M5 — Aspiration

- [x] Timeline GSAP (chargé à la demande, hors bundle de démarrage) : pendentif face au trou, attraction + FOV, tunnel, zoom blur, aberration, flash, sortie par l'anneau (provisoire)
- [x] Libération de la scène du pendentif, variante `prefers-reduced-motion` (fondu)
- [x] Entrée dans le portail : clic, Espace ou Entrée

## M6 — Système planétaire

- [x] Content collections + schéma zod, 39 contenus (15 projets, 14 compétences techniques, 6 savoir-être, 2 alternances, 2 formations), à relire
- [x] Système : étoile, orbites, planètes procédurales (TSL, 5 types) dérivées du contenu, lunes, ceinture, stations, vue 360° depuis l'anneau
- [x] Voyage « en fusée » (allumage, croisière, mise en orbite) → panneau HTML statique, état dans l'URL, retour (bouton, Échap, précédent)
- [x] Navigation clavier (liste masquée visible au focus) et variante `prefers-reduced-motion`
- [ ] Gyroscope sur mobile : reporté en M8

## M7 — Version HTML, SEO, accessibilité

- [x] Version classique complète (`/classique/`), « Passer l'intro », liens directs `#slug`, meta et Open Graph, JSON-LD, robots et sitemap
- [x] Lighthouse ≥ 95 sur la version HTML (100 / 100 / 100 / 100, mobile et ordinateur)

## M8 — Performance et production

- [x] Niveaux de qualité (bas, moyen, haut) : niveau de départ par indices de l'appareil, puis `PerformanceMonitor` (sans `detect-gpu`, voir SPEC §7) ; tactile plafonné à moyen
- [x] Profondeur de champ légère dans la forge, au niveau haut
- [x] Budgets de particules par niveau (étincelles à débit fixe : seul l'essaim change de densité)
- [x] Champs de bord du pendentif précalculés au build (`npm run bake`, 48 Ko gzip au lieu de 70 à 110 ms de calcul)
- [x] Pipeline `optimize:assets`, décodeurs auto-hébergés (Basis copié au build, Meshopt embarqué)
- [x] En-têtes vérifiés : A+ sur securityheaders.com
- [x] Rendu en pause quand l'onglet est caché (`requestAnimationFrame`), pas de saut au retour (pas de temps bornés)

## M8b — Finition du décor

- [x] Massifs de roche taillée (blocs coupés en biais), matière « roche taillée » (une nuance par face, grain, fissures fines)
- [x] Montagnes en cirque (fer à cheval) autour du pendentif, sol en cuvette accidenté
- [x] Cailloux instanciés selon le niveau de qualité, nuages en trois couches avec parallaxe

## M9 — Modèle final du pendentif

- [x] Cotes réelles (26 × 18 × 4 mm, argent 925), octogone aux arêtes adoucies, trou d'après la photo
- [x] Modèle construit par script Blender (`tools/blender/pendant.py`, headless) depuis le contour du site : érosion creusée dans le volume, croûte noire au fond des cavités, diamants posés par lancer de rayon
- [x] Export allégé (≈ 15 000 faces) → `npm run optimize:assets` (Meshopt, 296 Ko, 227 Ko gzip), aucune texture (tout est dans les shaders), donc pas de KTX2 ni de `toktx`
- [x] Chargé en chunk différé (hors budget de démarrage), même interface que le placeholder, repli automatique sur le placeholder ; testé WebGPU et WebGL 2

---

## Prompt de lancement (première session)

> Lis CLAUDE.md, docs/SPEC.md et docs/ROADMAP.md. On attaque le jalon M0.
> Avant de coder, propose-moi un plan : l'arborescence, les dépendances exactes avec la justification de chacune, et l'ordre des étapes.
> Signale aussi tout point de la SPEC qui te semble discutable ou risqué techniquement.

## Prompt type pour les jalons suivants

> Jalon Mx de docs/ROADMAP.md. Propose un plan, puis implémente étape par étape.
> Après chaque étape visuelle, prends une capture et décris ce que tu vois.
> Explique-moi les notions nouvelles (shaders, maths) au fur et à mesure.
> À la fin, coche les critères atteints dans ROADMAP.md et commite.
