import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ROUTES } from '../../paths';

@Component({
  selector: 'app-trace2',
  imports: [CommonModule, RouterLink],
  standalone: true,
  templateUrl: './trace2.component.html',
  styleUrl: './trace2.component.scss'
})
export class Trace2Component {
  protected readonly ROUTES = ROUTES;
}
