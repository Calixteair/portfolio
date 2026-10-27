# Portfolio 3D — Calixte Reymond

Page d'accueil / portfolio immersive pour calixteair.fr.
Au centre : mon pendentif brutaliste en 3D photoréaliste (plaque d'argent 925 brossé, 26 × 18 × 4 mm, deux coins coupés, trou érodé, croûte noire et diamants noirs dans l'érosion, sans bélière).
Les clics le font tourner et chauffent son bord (étincelles de métal en fusion). Après plusieurs tours, un portail s'ouvre.
Cliquer dessus aspire le visiteur dans un trou de ver. Il ressort par un anneau dans un système planétaire 3D, à 360° : chaque planète est un projet ou une compétence, et cliquer dessus lance un voyage « en fusée » jusqu'à elle, où s'affiche l'explication.
Ambiance : forge infernale côté pendentif, puis l'autre côté inspiré de _The Expanse_ (anneaux, protomolécule bleue, palette B). Rendu « comme une vidéo ».

- Cahier des charges complet : `docs/SPEC.md`. Lis-le avant toute tâche de conception.
- Feuille de route et jalon en cours : `docs/ROADMAP.md`.
- Photos de référence du pendentif : `docs/references/`.

## Comment travailler avec moi

- Je suis étudiant ingénieur en cybersécurité et je veux **comprendre** : pour chaque choix technique, explique brièvement le pourquoi et l'alternative écartée.
- Réponds en français. Le code, les noms et les messages de commit sont en anglais.
- Pour toute fonctionnalité non triviale, propose d'abord un plan et attends ma validation.
- Avance par petites étapes testables : une étape = un commit, avec un message conventionnel (`feat:`, `fix:`…).
- Tout changement visuel doit être vérifié avant d'annoncer que c'est fini : lance le serveur de dev, prends une capture avec le MCP Playwright et regarde-la.
- Aucune nouvelle dépendance sans justification (poids, maintenance, alternative native).
- Si une demande contredit `docs/SPEC.md`, signale-le au lieu de choisir en silence.

## Stack

- **Astro** en sortie **statique** (pas de SSR). La 3D est une île React `client:only="react"`.
- **Three.js `WebGPURenderer`** (repli automatique sur WebGL 2) + **React Three Fiber** + **drei**, **GSAP**, **leva** (en dev seulement).
- Post-traitement avec le pipeline natif de Three.js en TSL (bloom, etc.), **pas** `@react-three/postprocessing`, qui dépend de WebGL.
- TypeScript en mode `strict`.
- Shaders et compute shaders en **TSL** dans `src/shaders/*.ts`. Pas de GLSL : il ne fonctionne pas sur le backend WebGPU.
- Contenu : content collections Astro (`src/content/projects/*.md`), passées en props à l'île 3D.
- Déploiement : Docker multi-stage → `nginxinc/nginx-unprivileged`, derrière mon Nginx Proxy Manager (qui gère TLS et HTTP/2).

## Commandes (à créer au jalon M0)

- `npm run dev` / `npm run build` / `npm run preview`
- `npm run optimize:assets` : gltf-transform (Meshopt + KTX2)
- `docker compose up -d --build`

## Règles 3D (non négociables)

- Dans `useFrame`, modifier les objets via des `ref`, **jamais** avec `setState`.
- `dpr={[1, 2]}` et `PerformanceMonitor` pour adapter la qualité.
- Textures en KTX2, géométrie en Meshopt, HDRI en 1K maximum.
- Précompiler les shaders (`gl.compileAsync`) **avant** de masquer le loader.
- Appeler `dispose()` sur les géométries, matériaux et textures des scènes quittées.
- Les particules sont simulées par compute shader (TSL), jamais mises à jour une par une côté CPU. Toujours prévoir le repli WebGL 2 décrit dans la SPEC §5.4.
- Tester les deux backends : WebGPU (Chrome) et WebGL 2 forcé. Firefox sous Linux n'a pas encore WebGPU.
- Respecter `prefers-reduced-motion`.
- Le modèle final n'existe pas encore : utiliser le **placeholder procédural** décrit dans la SPEC (§6), qui expose la même interface que le futur GLB.

## Sécurité (je suis en cyber : c'est visible et évalué)

- CSP stricte, avec `'wasm-unsafe-eval'` (décodeurs WASM) et `worker-src blob:` (transcodeur KTX2).
- HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- Décodeurs Meshopt et Basis **auto-hébergés** (pas de CDN).
- Conteneur non-root, avec `read_only: true`.
- Objectif : A+ sur securityheaders.com.
