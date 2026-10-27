---
title: 'Infrastructure auto-hébergée (VPS)'
category: 'project'
summary: 'Une trentaine de services auto-hébergés, sécurisés et déployés en continu, montés seul.'
tags: ['Docker', 'Linux', 'Keycloak', 'OpenBao', 'WireGuard', 'Mailcow']
order: 1
planet: { 'type': 'rocky', 'hue': 215 }
---

Mon infrastructure auto-hébergée, montée et maintenue seul : une trentaine de services en Docker Compose sur un VPS Debian.

- **Infra** : reverse proxy avec TLS, SSO Keycloak, secrets dans OpenBao (plus aucun `.env` en clair), VPN WireGuard, tailnet Headscale, serveur mail Mailcow (10/10 sur mail-tester).
- **Sécurité** : un SOC complet (voir sa planète), CrowdSec branché sur le reverse proxy, durcissement SSH.
- **Applications** : Nextcloud, Obsidian LiveSync, n8n, Matrix avec ponts WhatsApp, Signal, Discord et Instagram, notifications ntfy, site de cours, Jellyfin.
- **Projets hébergés** : kalidoku, BYD, DevSecVault, Belforaine, ce portfolio, mon assistant personnel.
- **Méthode** : une stack Compose par service, déploiements CI via des comptes SSH à commande forcée, sauvegardes restic chiffrées hors du VPS.
