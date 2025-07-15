import { Component } from '@angular/core';
import {ROUTES} from '../../paths';
import { Router } from '@angular/router';

@Component({
  selector: 'app-home',
  imports: [
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  standalone: true,
})
export class HomeComponent {

  constructor(private router: Router) {}

  goToCompetences() {
      this.router.navigate(['/'+ ROUTES.COMPETENCES]);
  }

  protected readonly ROUTES = ROUTES;
}
