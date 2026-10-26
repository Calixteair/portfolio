---
title: 'SOC self-hosted'
category: 'project'
summary: 'SIEM et détection sur mon VPS : Wazuh, Falco eBPF, CrowdSec, Prometheus et Grafana.'
tags: ['Wazuh', 'Falco', 'CrowdSec', 'Prometheus', 'Grafana', 'MITRE ATT&CK']
order: 2
planet: { 'type': 'lava', 'hue': 8 }
---

Un SOC self-hosted sur mon VPS, monté en quatre phases :

- **Wazuh** (SIEM) : intégrité des fichiers, détection de brute-force, règles mappées sur MITRE ATT&CK.
- **Falco** en eBPF sur l'hôte : comportements suspects des conteneurs, remontés directement dans Wazuh.
- **CrowdSec** : blocage des IP malveillantes au niveau du reverse proxy.
- **Prometheus + Grafana + Alertmanager** : métriques, tableaux de bord et alertes par mail, validées de bout en bout.

Les configurations sont versionnées, sans aucun secret.
