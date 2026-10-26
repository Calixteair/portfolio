---
title: 'Écosystème BYD'
category: 'project'
summary: 'Réservation de bornes de recharge : API Spring Boot, app Angular/Capacitor, OCR.'
tags: ['Java', 'Spring Boot', 'Angular', 'Capacitor', 'FastAPI', 'Keycloak']
order: 6
planet: { 'type': 'rocky', 'hue': 140 }
---

Un écosystème de réservation de bornes de recharge, réalisé en équipe.

- **API** Java 17 / Spring Boot 3, sécurisée par Keycloak (OAuth2, JWT), PostgreSQL.
- **App mobile** Angular + Capacitor avec cartographie des stations (Leaflet).
- **Back-office** Angular pour les opérateurs.
- **Microservice OCR** (FastAPI, Google Vision, OpenCV) qui lit les cartes grises à l'inscription.
