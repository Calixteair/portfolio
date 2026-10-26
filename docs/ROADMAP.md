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

- [ ] Render target du système planétaire (provisoire) en demi-résolution, lumière bleue qui déborde sur la croûte
- [ ] Ouverture animée depuis le centre, front irrégulier et bord incandescent

## M5 — Aspiration

- [ ] Timeline GSAP : FOV, tunnel, zoom blur, flash, sortie par l'anneau
- [ ] Libération de la scène du pendentif, variante `prefers-reduced-motion`

## M6 — Système planétaire

- [ ] Content collections + schéma zod, 3 contenus d'exemple
- [ ] Système : étoile, orbites, planètes procédurales (TSL) dérivées du contenu, vue 360° depuis l'anneau
- [ ] Voyage « en fusée » (allumage, croisière, mise en orbite) → panneau HTML, état dans l'URL, retour
- [ ] Navigation clavier et variante `prefers-reduced-motion`

## M7 — Version HTML, SEO, accessibilité

- [ ] Version classique complète, « Passer l'intro », meta et Open Graph
- [ ] Lighthouse ≥ 95 sur la version HTML

## M8 — Performance et production

- [ ] detect-gpu + PerformanceMonitor, budgets de la SPEC §7 respectés
- [ ] Profondeur de champ légère (reportée de M1), activée selon le niveau de qualité
- [ ] Budgets de particules par niveau de qualité : 32 768 étincelles en WebGPU aujourd'hui (65 536 tiennent 129 fps sur un GPU haut de gamme), cible SPEC ≈ 65 000
- [ ] Finition du décor (SPEC §5.1 « rendu final ») : érosion, normal maps, cailloux instanciés, nuages en couches
- [ ] Champs de bord du pendentif précalculés au build (111 ms au démarrage aujourd'hui)
- [ ] Pipeline `optimize:assets`, décodeurs auto-hébergés
- [ ] Déploiement sur le VPS, en-têtes vérifiés (securityheaders.com A+)

## M9 — Intégration du modèle final (à la livraison de l'artiste)

- [ ] Remplacer le placeholder par le GLB optimisé, sans toucher au reste

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
