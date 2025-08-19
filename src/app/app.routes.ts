import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { AboutComponent } from './pages/about/about.component';
import { CompetencesComponent } from './pages/competences/competences.component';

import { ROUTES } from './paths';
import {Trace1Component} from "./traces/trace1/trace1.component";
import {Trace2Component} from "./traces/trace2/trace2.component";
import {Trace3Component} from "./traces/trace3/trace3.component";

export const routes: Routes = [
  { path: ROUTES.HOME, component: HomeComponent },
  { path: ROUTES.ABOUT, component: AboutComponent },
  { path: ROUTES.COMPETENCES, component: CompetencesComponent },
  { path: ROUTES.TRACE1, component: Trace1Component },
  { path: ROUTES.TRACE2, component: Trace2Component },
  { path: ROUTES.TRACE3, component: Trace3Component },
];
