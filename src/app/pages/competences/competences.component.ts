import { Component } from '@angular/core';
import {RouterLink, RouterLinkActive} from '@angular/router';
import {CompetenceCardComponent} from '../../components/competence-card/competence-card.component';
import {Competence} from '../../models/competence.model';
import {CommonModule} from '@angular/common';

@Component({
  selector: 'app-competences',
  imports: [CompetenceCardComponent, CommonModule],
  standalone: true,
  templateUrl: './competences.component.html',
  styleUrl: './competences.component.scss'
})
export class CompetencesComponent {

  competences: Competence[] = [
    {
      title: 'Batch Cloture Espaces',
      technos: ['Java', 'Spunk'],
      date: '2024',
      context: 'Portfolio',
      logos: ['spring-boot.png', 'Splunk_logo.png'],
      idTrace: "1",
      competence: "Réaliser un développement d’application"
    },
    {
      title: 'Récupération automatique d’informations dans des documents',
      technos: ['Java', 'Angular, SQL'],
      date: '2025',
      context: 'Alternance',
      logos: ['spring-boot.png', 'Postgresql_elephant.png', 'angular.png'],
      idTrace: "2",
      competence: "Gestion des Données de l'Information"
    },
    {
      title: 'Collaborer au sein d\'une équipe informatique',
      technos: ['communication'],
      date: '2024 2025',
      context: 'SAE',
      logos: ['jira.png', 'agile.png'],
      idTrace: "3",
      competence: "RCollaborer au sein d'une équipe informatique"
    }
  ];

}
