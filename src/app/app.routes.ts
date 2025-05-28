import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { AboutComponent } from './pages/about/about.component';
import { ProjectsComponent } from './pages/projects/projects.component';

import { ROUTES } from './paths';
import {Trace1Component} from "./traces/trace1/trace1.component";

export const routes: Routes = [
  { path: ROUTES.HOME, component: HomeComponent },
  { path: ROUTES.ABOUT, component: AboutComponent },
  { path: ROUTES.PROJECTS, component: ProjectsComponent },
  { path: ROUTES.TRACE1, component: Trace1Component },
];
