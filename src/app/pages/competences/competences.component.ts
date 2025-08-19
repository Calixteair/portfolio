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
      title: 'OCPP',
      technos: ['Java', 'Angular'],
      date: '2025',
      context: 'Alternance',
      logos: ['angular.png'],
      idTrace: "1",
      competence: "Réaliser un développement d’application"
    },
    {
      title: 'Batch purge RGPD',
      technos: ['Java'],
      date: '2024',
      context: 'SAE',
      logos: ['angular.png', 'spring-boot.png'],
      idTrace: "1",
      competence: "Réaliser un développement d’application"
    }
  ];

}
