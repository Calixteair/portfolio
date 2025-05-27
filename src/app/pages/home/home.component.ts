import { Component } from '@angular/core';
import {ROUTES} from '../../paths';
import {RouterLink} from '@angular/router';
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



  goToProjects() {
      this.router.navigate(['/'+ ROUTES.PROJECTS]);
  }

  protected readonly ROUTES = ROUTES;
}
