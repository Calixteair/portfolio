---
title: 'Jenkins mutualisé'
category: 'project'
summary: 'CI/CD de mes projets : Jenkins en configuration as code, agents isolés, SSO.'
tags: ['Jenkins', 'JCasC', 'Docker', 'Keycloak']
order: 8
planet: { 'type': 'rocky', 'hue': 40 }
---

Le serveur d'intégration continue mutualisé de tous mes projets.

- Configuration entièrement en code (JCasC).
- Contrôleur sans exécuteur, agents de build isolés (Docker-in-Docker).
- Connexion via SSO Keycloak, intégration GitHub par GitHub App.
