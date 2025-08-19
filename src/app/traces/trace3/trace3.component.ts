import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ROUTES } from '../../paths';

@Component({
  selector: 'app-trace3',
  imports: [CommonModule, RouterLink],
  standalone: true,
  templateUrl: './trace3.component.html',
  styleUrl: './trace3.component.scss'
})
export class Trace3Component {
  protected readonly ROUTES = ROUTES;
}
