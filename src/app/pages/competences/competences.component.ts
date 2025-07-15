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
      title: 'OCPM',
      technos: ['Java', 'Angular'],
      date: '2024',
      context: 'Alternance',
      logos: ['angular.png', 'spring-boot.png'],
      idTrace: "1"
    },
    {
      title: 'OCPP',
      technos: ['Java', 'Angular'],
      date: '2025',
      context: 'Alternance',
      logos: ['angular.png'],
      idTrace: "1"
    },
    {
      title: 'Batch purge RGPD',
      technos: ['Java'],
      date: '2024',
      context: 'Alternance',
      logos: ['angular.png', 'spring-boot.png'],
      idTrace: "1"
    }
  ];

}
