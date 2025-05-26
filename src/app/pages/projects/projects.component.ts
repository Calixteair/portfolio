import { Component } from '@angular/core';
import {RouterLink, RouterLinkActive} from '@angular/router';
import {ProjectCardComponent} from '../../components/project-card/project-card.component';
import {Project} from '../../models/project.model';
import {CommonModule} from '@angular/common';

@Component({
  selector: 'app-projects',
  imports: [ProjectCardComponent, CommonModule],
  standalone: true,
  templateUrl: './projects.component.html',
  styleUrl: './projects.component.scss'
})
export class ProjectsComponent {

  projects: Project[] = [
    {
      title: 'OCPM',
      technos: ['Java', 'Angular'],
      date: '2024',
      context: 'Alternance'
    },
    {
      title: 'OCPP',
      technos: ['Java', 'Angular'],
      date: '2025',
      context: 'Alternance'
    },
    {
      title: 'Batch purge RGPD',
      technos: ['Java'],
      date: '2024',
      context: 'Alternance'
    }
  ];

}
