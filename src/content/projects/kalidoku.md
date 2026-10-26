---
title: 'kalidoku'
category: 'project'
summary: "Jeu quotidien d'association avec classement : Rust (Axum) et Astro/Svelte, en PWA."
tags: ['Rust', 'Axum', 'Svelte', 'PWA', 'PostgreSQL']
order: 4
links:
  [
    { label: 'Jouer (site en ligne)', url: 'https://kalidoku.calixteair.fr' },
    { 'label': 'Code source (GitHub)', 'url': 'https://github.com/Calixteair/kalidoku' },
  ]
planet: { 'type': 'gas', 'hue': 30 }
---

Un jeu quotidien d'association multi-domaines, façon _Connections_, avec un vrai classement.

- Backend **Rust** (Axum, SeaORM, PostgreSQL), frontend Astro + Svelte 5.
- PWA mobile-first, prête pour Capacitor.
- Auth Keycloak, anti-bot Altcha, CI avec audits de dépendances (cargo-audit, cargo-deny, Trivy).
- Open source, licence AGPL.
