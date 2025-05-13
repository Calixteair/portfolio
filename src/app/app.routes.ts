import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { AboutComponent } from './pages/about/about.component';
import { ProjectsComponent } from './pages/projects/projects.component';

import { ROUTES } from './paths';

export const routes: Routes = [
  { path: ROUTES.HOME, component: HomeComponent },
  { path: ROUTES.ABOUT, component: AboutComponent },
  { path: ROUTES.PROJECTS, component: ProjectsComponent }
];
