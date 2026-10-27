# Cahier des charges — Portfolio 3D

## 1. Vision

Une expérience d'accueil qu'on regarde « comme une vidéo », mais interactive. Le visiteur manipule un objet (le pendentif). Plus il interagit, plus ça s'intensifie (chaleur, étincelles), jusqu'à ouvrir un passage vers le contenu du portfolio.

**Arc narratif** : forge (loader) → objet froid → chauffe → surchauffe → portail → aspiration → espace du portfolio.
Chaque étape annonce la suivante **sans la dévoiler**. On ne montre jamais le trou noir avant la fin.

**Direction artistique** : deux mondes, la forge puis l'autre côté.

- **Forge (pendentif)** : fond quasi noir, lumières chaudes rasantes venant du bas (rouge et orange), brume légère.
- **L'autre côté (portail, trou de ver, espace)** : référence aux anneaux et à la protomolécule de _The Expanse_. Vide noir, filaments bleus bioluminescents, anneau sombre à la surface liquide. On s'inspire de l'esthétique, sans reprendre d'image, de logo ni de modèle de la série.
- **Palette retenue : B « Braise contaminée »** (prototype `docs/explorations/`) : le bleu domine de l'autre côté, mais des braises rouges du pendentif y dérivent. Le bord du portail reste incandescent.

| Rôle                    | Couleur                                   |
| ----------------------- | ----------------------------------------- |
| Vide                    | `#02040c`                                 |
| Nébuleuse               | `#0c2348`                                 |
| Filaments protomolécule | `#2f6bff`                                 |
| Cœur lumineux           | `#b4e0ff`                                 |
| Bord du portail         | `#ff5a14`                                 |
| Braises                 | `#ff5a1a` (≈ 50 % des particules de fond) |

- Matériaux crédibles : acier brossé satiné, croûte noire granuleuse autour du trou, diamants noirs très brillants (photos dans `docs/references/`).
- Post-traitement « caméra » : bloom, tone mapping AgX, légère profondeur de champ (reportée en M8 avec les niveaux de qualité), grain, vignette, aberration chromatique discrète.
- Mouvements physiques : inertie, ressorts, jamais linéaires.

## 2. Parcours utilisateur et machine à états

```
loading → ready("Entrer") → idle → heating → overheated → portalOpen → wormhole → portfolio
                                  ↑________↓ (refroidit si on arrête de cliquer)
```

| État         | Entrée             | Ce qui se passe                                                                                                                 | Sortie                                 |
| ------------ | ------------------ | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `loading`    | page ouverte       | Loader HTML/CSS : un fil incandescent trace le contour du pendentif (§4)                                                        | assets chargés + shaders compilés      |
| `ready`      | chargement terminé | Bouton « Entrer ». Le clic débloque l'audio et lance un fondu depuis le noir                                                    | clic                                   |
| `idle`       | —                  | Pendentif froid, légère rotation « respiration »                                                                                | 1er clic                               |
| `heating`    | clic               | Chaque clic ajoute une impulsion de rotation et `heat += Δ`. `heat` décroît avec le temps. Étincelles proportionnelles à `heat` | `heat ≥ 0,85` **et** tours cumulés ≥ N |
| `overheated` | seuil atteint      | Bord chauffé à blanc, tremblement léger, distorsion de chaleur                                                                  | après environ 1,5 s                    |
| `portalOpen` | —                  | Le trou érodé s'ouvre sur la scène du portfolio (render target)                                                                 | clic sur le portail                    |
| `wormhole`   | clic               | Timeline GSAP d'aspiration (§5.6)                                                                                               | fin de la timeline                     |
| `portfolio`  | —                  | Système planétaire à 360° (§5.7). Clic sur une planète : voyage puis panneau de détail ; retour au point d'arrivée              | —                                      |

- La machine à états est du **TypeScript pur**, sans dépendance au rendu, testable unitairement.
- Tous les seuils (N, Δ, vitesse de refroidissement…) sont des constantes réglables avec leva en dev.
- Un bouton « Passer l'intro » est visible dès `ready` et saute directement à `portfolio`.
- Avec `prefers-reduced-motion` : pas de tremblement ni de rotation de caméra, et l'aspiration est remplacée par un fondu court.

## 3. Pages et SEO

- `index.astro` contient : le loader (HTML/CSS inline), l'île 3D, et une **version HTML complète** du contenu (projets, compétences, expériences, contact).
- La version HTML est ce que voient Google, les lecteurs d'écran, les appareils sans WebGL, et les visiteurs qui choisissent « Version classique ». _Tranché en M7_ : elle vit aussi sur sa propre page `/classique/`, sans l'île 3D (≈ 430 Ko de JS en moins, Lighthouse 100), avec les mêmes articles que les panneaux (`EntryArticle`) et un `canonical` vers `/`. « Passer l'intro » mène, lui, au système planétaire (§2).
- Un lien direct vers un astre (`/#slug`) saute l'intro puis vole jusqu'à lui.
- Balises meta, Open Graph et image de partage (une capture du pendentif incandescent).

## 4. Loader

- En **HTML/CSS inline**, sans JavaScript de framework : il s'affiche au premier octet reçu.
- Un SVG `<path pathLength="100">` suit le **contour exact** du pendentif (généré au build depuis le même `outerOutline` que la 3D). On l'anime avec `stroke-dashoffset: calc(100 - var(--p))`. _Tranché en M2_ : un `<rect>` n'aurait que le ratio, le contour exact rend le raccord invisible.
- Couleur de corps noir : les segments récents sont blancs ou jaunes, les plus anciens refroidissent vers l'orange puis le rouge. Lueur avec `drop-shadow`, quelques étincelles à la pointe.
- Progression : étapes réelles (île chargée, renderer, scène, assets, shaders compilés), **lissée** par interpolation. Les 10 derniers pour cent sont réservés à `gl.compileAsync`. `useProgress` (drei) s'ajoutera à l'étape « assets » avec les premiers fichiers téléchargés (GLB, KTX2).
- À 100 % : le pendentif 3D apparaît **à la même position et à la même taille** pendant que le contour s'éteint (raccord dans le mouvement).
- Si le cache est chaud (chargement < 300 ms), on saute directement à `ready`.
- Si WebGL est indisponible ou si le chargement dépasse 10 s, on propose la version HTML.
- `role="progressbar"`, `aria-valuenow`.

## 5. Effets

### 5.1 Scène du pendentif

- Environnement sombre avec des sources chaudes, utilisé pour les reflets et non affiché en fond. **Tranché en M1** : PMREM généré au démarrage à partir d'une petite scène émissive (panneaux chauds en bas, bande froide derrière), au lieu d'une HDRI 1K : rien à télécharger, pas de licence, réglable. Une HDRI reste possible plus tard sans changer l'interface.
- Lumière principale rasante orange-rouge venant du bas, contre-jour froid et faible pour détacher la silhouette.
- Rotation : clic ou glisser. On applique une impulsion angulaire avec amortissement, pas un tween linéaire.

**Décor : un monde, pas un fond**

- **Pics et montagnes** à facettes, aux arêtes vives, d'aspect brutaliste et futuriste (béton coulé, roche taillée), répartis sur **plusieurs plans** qui s'estompent dans la brume :
  1. rochers et petits pics proches, les plus réactifs à la chauffe ;
  2. pics à moyenne distance ;
  3. grandes montagnes ;
  4. chaînes lointaines, en silhouette seulement.
- **Sol** : roche sombre et cassée, de plus en plus accidentée en s'éloignant. Il reste quasi plat sous le pendentif, là où les étincelles rebondissent.
- **Ciel** : étoiles fixes qui scintillent légèrement, nuages fins qui dérivent lentement, brume à l'horizon.
- **Réaction à la chauffe** : à froid, le monde est presque invisible dans la pénombre. Quand `uHeat` monte, la lueur du pendentif éclaire les rochers proches, des fissures prennent une faible lueur orange (surtout près du pendentif), le dessous des nuages et l'horizon rougeoient.
- Composition : le pendentif reste la vedette ; le décor ne doit jamais lui voler la lumière.
- Collisions : les formes proches sont décrites par des **SDF analytiques** (cônes, boîtes chanfreinées), avec le même code que pour le sol (§5.4).
- Rendu final (au-delà du prototype `docs/explorations/pendant-forge.html`) : terrain sculpté avec érosion et normal maps, textures de roche, cailloux instanciés, nuages en couches avec parallaxe. Les plans lointains peuvent être une image peinte ou une HDRI dédiée, pour les performances.
- _Tranché en M8b_ : **roche taillée** (pas béton coulé), tout procédural. Chaque pic est un massif de 3 à 5 blocs coupés en biais ; chaque face a sa nuance. Les montagnes forment un **cirque** en fer à cheval ouvert vers la caméra, ses bras encadrant le pendentif ; le sol, plat sous le pendentif (rebonds des étincelles), se creuse puis remonte vers les murs. Cailloux instanciés (150 à 800 selon le niveau), trois couches de nuages.

### 5.2 Matériaux

- Acier : matériau physique (`MeshPhysicalNodeMaterial`) avec metalness 1, une **roughness map** brossée et de l'**anisotropie** (validée par le prototype : c'est elle qui donne l'aspect brossé).
- Croûte d'érosion : noire, non métallique, presque sans reflet. Elle borde le trou et déborde sur la face en éclaboussures.
- Diamants noirs : diélectrique très brillant, facettes nettes, **sans réfraction** (le diamant noir est quasi opaque). Instanciés, sertis dans la croûte.

### 5.3 Chauffe

- Uniform `uHeat` (0 à 1) combiné avec deux champs de distance : au **bord du trou** et au **bord extérieur**.
- Source principale : le **bord du trou**, qui monte jusqu'au blanc. Source secondaire : le **bord extérieur**, avec un poids d'environ 0,6, qui reste dans l'orange. Les deux poids sont réglables.
- La chaleur progresse des bords vers l'intérieur de la plaque.
- Couleur de corps noir en **émissive** : rouge sombre → orange → jaune → blanc, pour déclencher le bloom.
- **Teintes de revenu** persistantes (paille, bronze, bleu) sur les zones qui ont déjà chauffé, avec un `uHeatHistory` qui ne redescend pas.

### 5.4 Particules (simulation physique GPU)

Toutes les particules sont simulées par un **compute shader WebGPU** (TSL), dans des buffers de stockage. Rien n'est mis à jour particule par particule côté CPU.

**Étincelles (métal en fusion)**

- Émises depuis les bords chauds (≈ 75 % depuis le trou, ≈ 25 % depuis le bord extérieur), avec un taux proportionnel à `uHeat`.
- Gravité, traînée de l'air, durée de vie courte, couleur de corps noir qui refroidit, particules étirées dans le sens de la vitesse, mélange additif.
- **Collisions** avec rebond (restitution et frottement) :
  - **pendentif** : champ de distance signé (SDF) exact, obtenu à partir du contour 2D et de l'épaisseur. La particule est testée dans le repère du pendentif, et la vitesse de surface due à la rotation lui est transmise (le pendentif qui tourne projette les étincelles) ;
  - **sol** : plan, sur lequel les étincelles rebondissent, glissent, refroidissent et s'éteignent ;
  - **éléments de décor** : SDF analytiques (boîtes, cylindres) ou SDF 3D précalculée au build pour une forme complexe. _M3_ : non implémenté, les étincelles retombent avant les rochers les plus proches (4,5 m) ; à ajouter si on en voit les atteindre.

**Particules de protomolécule**

- Une partie des particules qui sortent du trou sont de la protomolécule, pas du métal : bleues (`#2f6bff` → `#b4e0ff`), bioluminescentes.
- Elles **n'obéissent pas à la gravité** : elles dérivent en essaim (curl noise), sont attirées par la croûte du trou et rampent sur la surface du pendentif.
- Elles apparaissent quand le pendentif surchauffe, deviennent plus nombreuses à l'ouverture du portail et annoncent l'autre côté sans le dévoiler.

**Repli WebGL 2** : si WebGPU est indisponible, la scène tourne sur le backend WebGL 2 de Three.js. Si les compute shaders n'y sont pas disponibles, les étincelles passent en trajectoire balistique calculée dans le vertex shader, sans collisions, et les particules de protomolécule sont réduites.

### 5.5 Distorsion de chaleur et portail

- La distorsion est un effet de post-traitement : un décalage des UV avec du bruit, masqué au-dessus des bords chauds.
- Le portail occupe la forme exacte du trou et affiche la **scène du portfolio en render target, en demi-résolution**. _Tranché en M4_ : c'est une **fenêtre**, pas une image plaquée : la caméra du portail garde la pose de la vraie caméra par rapport au pendentif, d'où une parallaxe quand il tourne. Le système planétaire est provisoire jusqu'au M6 ; pendant l'ouverture, les étincelles se raréfient (jusqu'à −85 %) pour que le regard aille au portail. Il s'ouvre depuis le centre, avec un front irrégulier ; son bord est incandescent (palette B).
- La lumière bleue qui sort du portail éclaire la croûte et les parois du trou.

### 5.6 Aspiration (trou de ver)

Timeline GSAP d'environ 3 s :

1. La caméra est attirée vers le portail et le FOV s'élargit brutalement (effet vertigo).
2. On entre dans un `TubeGeometry` qui suit une courbe. Un shader fait défiler du bruit sur les parois, avec une légère rotation de la caméra.
3. Le zoom blur et l'aberration chromatique montent en intensité. Lentille gravitationnelle optionnelle.
4. Un flash, puis on sort de l'anneau dans le système planétaire (§5.7), **déjà rendu** dans le portail : pas de coupure.

Ensuite, on libère la scène du pendentif (`dispose`).

_Tranché en M5_ : on entre par un clic, Espace ou Entrée sur le portail ouvert. Au départ, le pendentif revient à son angle de repos pour que le trou fasse face à la caméra et cadre l'étoile. GSAP est chargé à la demande après « Entrer » (≈ 28 Ko gzip, hors budget de démarrage). L'anneau d'arrivée est provisoire jusqu'au M6.

### 5.7 Espace du portfolio : un système planétaire

Dans _The Expanse_, les anneaux mènent à d'autres systèmes stellaires. Ici, le portail est une porte : on en sort dans un **système planétaire 3D** dont chaque planète est un contenu du portfolio.

**Immersion**

- La caméra est au point d'arrivée, juste devant l'anneau qu'on vient de traverser, qui reste visible derrière soi. On regarde à 360° : `OrbitControls` en rotation seule, avec inertie, sans zoom ni déplacement latéral. Gyroscope en option sur mobile.
- Une étoile centrale éclaire le système. Ambiance palette B : vide noir, nébuleuse bleue profonde, filaments de protomolécule, braises rouges qui dérivent parmi les particules bleues.
- Les planètes sont procédurales (shaders TSL) : leur aspect découle du contenu (catégorie, `planet` dans le frontmatter, §6). Elles tournent lentement sur leurs orbites, mais restent faciles à viser.
- Chaque planète a une étiquette lisible (titre) qui apparaît au survol ou au focus.

**Organisation du système** (validée)

- Une seule étoile.
- **Projets = planètes.** Leur taille et leur orbite dépendent de `order`.
- **Compétences = lunes** de la planète du projet qui les utilise (`orbits` dans le frontmatter). Une compétence sans projet rejoint une **ceinture d'astéroïdes**, dont elle est un astéroïde cliquable.
- **Expériences = stations orbitales** : structures artificielles, brutalistes, en orbite autour de l'étoile.
- Le voyage fonctionne de la même façon vers une planète, une lune ou une station.

**Voyage « en fusée »** (clic sur une planète, timeline GSAP d'environ 2,5 s)

1. **Allumage** : léger recul puis accélération, FOV qui se resserre, tremblement discret, grondement grave.
2. **Croisière** : étoiles et particules étirées en traînées (effet de vitesse), flou de mouvement léger.
3. **Freinage et mise en orbite** : décélération amortie, la caméra se place en orbite autour de la planète, qui occupe une bonne partie de l'écran.
4. Un **panneau HTML** s'ouvre à côté de la planète : l'explication du projet ou de la compétence, lisible, accessible, avec des liens.

- Retour : bouton, touche Échap ou bouton « précédent » du navigateur. On refait le trajet en sens inverse vers le point d'arrivée.
- Avec `prefers-reduced-motion` : fondu court au lieu du vol.

**Navigation et accessibilité**

- État dans l'URL (`#projet-slug`) pour partager un lien direct vers une planète et gérer le bouton retour.
- Une **carte du système** (ouverte au départ, repliable avec `M`) liste tous les astres par groupe, avec une recherche (titre, résumé, tags ; accents et casse ignorés). Les résultats s'éclairent en 3D, le reste s'estompe ; Entrée part vers le premier. Elle pilote la même navigation, au clavier comme à la souris.
- `I` affiche les titres des projets et des parcours en cartes au-dessus des astres. Le survol (souris, carte, liste) éclaire l'astre et sa trace d'orbite.
- _Tranché en M8_ : le voyage est une **navette** et non un zoom : trajectoire courbe (Bézier) qui part dans le sens du mouvement, contourne l'étoile et s'insère tangentiellement sur l'orbite de la cible ; la caméra regarde la route, s'incline dans les virages, puis se tourne vers l'astre. 2,5 à 5 s selon la distance.
- Cliquer sur l'anneau ramène à la forge (option, à valider en test).

## 6. Contenu

Fichiers `src/content/projects/*.md`, dont le frontmatter est validé par un schéma zod :

```yaml
title: string
category: project | skill | experience
summary: string        # 1 ligne, affichée dans l'étiquette de la planète
tags: string[]
links: { label: string, url: string }[]
order: number          # importance : influence la taille et l'orbite
orbits: string[]       # compétences seulement : projets ou expériences qui la montrent ; la 1re est l'hôte de la lune (sinon ceinture)
kind: technical | soft # compétences seulement : technique ou savoir-être
station: work | education # expériences seulement : alternance/emploi ou formation
period: string         # expériences seulement
planet:                # optionnel, sinon dérivé de la catégorie
  type: rocky | gas | ice | lava | ocean
  hue: number          # 0-360, teinte dominante
```

Placeholder pour le pendentif (en attendant le GLB de l'artiste) : une plaque **à angles coupés** (octogone allongé, ratio ≈ 1,45), extrudée avec un biseau, **sans bélière**. Le trou est un rectangle arrondi décalé, déformé par du bruit. Les diamants sont instanciés dans l'érosion. Ces formes sont celles du prototype `docs/explorations/pendant-forge.html`. Il expose la même interface que le futur GLB : `body` (mesh), `diamonds` (InstancedMesh), `edgeMask` (texture).

## 7. Budgets de performance

| Mesure                     | Cible                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------- |
| JS initial (gzip)          | < 450 Ko pour l'île 3D (`three/webgpu` ≈ 300 Ko) ; scène portfolio chargée en différé |
| Assets 3D totaux           | < 8 Mo                                                                                |
| Images par seconde         | 60 sur un ordinateur récent, ≥ 30 sur un mobile milieu de gamme                       |
| Particules simulées        | ≈ 20 000 sur un ordinateur récent, ≈ 6 000 sur mobile, ajusté par niveau de qualité   |
| Premier affichage (loader) | < 1 s                                                                                 |
| Lighthouse (version HTML)  | ≥ 95 en performance, accessibilité, bonnes pratiques et SEO                           |

- Niveaux de qualité (`src/three/quality.ts`) : niveau de départ par indices de l'appareil (backend, écran tactile, nombre de cœurs), puis `PerformanceMonitor` en continu. On ajuste le DPR, les particules, la profondeur de champ et la résolution du portail. _Tranché en M8_ : pas de `detect-gpu`, qui télécharge sa base de benchmarks sur un CDN interdit par la CSP ; les écrans tactiles sont plafonnés au niveau moyen (batterie, chauffe).
- _Tranché en M8_ : les étincelles naissent à débit fixe (quelques centaines par seconde, choix du M3) ; un pool plus grand que les étincelles vivantes ne changerait rien à l'image. D'où un budget plus bas que les 65 000 envisagés : seul l'essaim gagne en densité au niveau haut.
- Le rendu se met en pause quand l'onglet est caché.

## 8. Déploiement et sécurité

- `Dockerfile` multi-stage : `node:24-alpine` (build, Node 24 LTS épinglé dans `.nvmrc`), puis `nginxinc/nginx-unprivileged:alpine` (runtime).
- `nginx.conf` :
  - `Cache-Control: public, max-age=31536000, immutable` sur les fichiers avec hash, `no-cache` sur le HTML ;
  - gzip ou Brotli ;
  - types MIME `application/wasm`, `model/gltf-binary`, `image/ktx2` ;
  - en-têtes de sécurité (voir CLAUDE.md).
- `docker-compose.yml` : `read_only: true`, `tmpfs` pour les dossiers temporaires de nginx, `cap_drop: [ALL]`, `no-new-privileges`, réseau partagé avec Nginx Proxy Manager.

## 9. Asset final (commandé à un artiste)

`.glb` optimisé pour Three.js, avec :

- matériaux PBR metal/roughness ;
- low-poly (< 50 000 triangles) avec normal map et AO bakées ;
- textures 2K et UV propres ;
- diamants dans un mesh séparé ;
- texture `edgeMask` ;
- échelle réelle en mètres, origine centrée ;
- fichier `.blend` source fourni.

On le passe ensuite dans `npm run optimize:assets`.

## 10. Questions ouvertes

- Son : ambiance grave, crépitements, aspiration. Quelle source, et quelle licence ?
- Liste définitive des projets et compétences.
- Nombre de tours N avant l'ouverture du portail : 2 en M3 (comme le prototype), réglable dans leva, à confirmer en test.

## 11. Compatibilité WebGPU (tranché en M0, 2026-10-15)

- **R3F 9 stable** (9.8.2), pas la v10 alpha : le prop `gl` accepte une fabrique asynchrone qui crée un `WebGPURenderer` et attend `init()`.
- **Compute TSL** : le même compute shader tourne en WebGPU et sur le repli WebGL 2 (transform feedback). Le repli de la §5.4 garde donc la même simulation, seulement avec moins de particules.
- **Chrome headless (SwiftShader)** : son WebGPU logiciel perd le device. En CI, les tests e2e passent par le repli WebGL 2 forcé (`?gl=webgl2`) ; le chemin WebGPU se vérifie sur un vrai GPU.
- **drei** avec `WebGPURenderer` (drei 10.7.9, testé sur les deux backends) :

| Composant            | WebGPU | WebGL 2 | Décision                                                                                                            |
| -------------------- | ------ | ------- | ------------------------------------------------------------------------------------------------------------------- |
| `Float`              | ✅     | ✅      | Utilisable                                                                                                          |
| `OrbitControls`      | ✅     | ✅      | Utilisable                                                                                                          |
| `PerformanceMonitor` | ✅     | ✅      | Utilisable                                                                                                          |
| `Html`               | ✅     | ✅      | Utilisable (avertissement React en dev au démontage, sans effet)                                                    |
| `Environment`        | ✅     | ❌      | Ne pas l'utiliser : la sphère disparaît sur le repli, et les presets viennent d'un CDN. PMREM maison en M1          |
| `Text` (troika)      | ❌     | ❌      | Ne pas l'utiliser : shader GLSL ignoré (carré plein), polices chargées depuis jsDelivr. Étiquettes en HTML (`Html`) |
| `Stars`              | ❌     | ❌      | Ne pas l'utiliser : `ShaderMaterial` GLSL refusé. Ciel étoilé en TSL (§5.1)                                         |

Règle générale : tout composant drei qui embarque un `ShaderMaterial` GLSL est incompatible. Il faut le refaire en TSL.
