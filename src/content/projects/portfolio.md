---
title: 'Ce portfolio'
category: 'project'
summary: 'WebGPU et compute shaders, CSP stricte et livraison signée : le site que vous visitez.'
tags: ['WebGPU', 'Three.js', 'TSL', 'Astro', 'cosign']
order: 7
links:
  [
    {
      'label': 'Code source (GitHub)',
      'url': 'https://github.com/Calixteair/portfolio/tree/newgen',
    },
  ]
planet: { 'type': 'lava', 'hue': 22 }
---

Le site que vous visitez.

- **WebGPU** avec repli automatique sur WebGL 2, shaders et compute shaders en TSL : étincelles et particules simulées sur le GPU, collisions avec le pendentif en rotation.
- Astro statique, React Three Fiber, GSAP chargé à la demande.
- **Sécurité** : CSP stricte à base de hash, conteneur non-root en lecture seule.
- **Chaîne de livraison** : scan Trivy, SBOM, provenance et signature cosign avant chaque déploiement.
