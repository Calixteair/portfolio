import { Component } from '@angular/core';
import {NgClass} from '@angular/common';
import {RouterLink, RouterLinkActive} from '@angular/router';
import {ROUTES} from '../../paths';
import {LucideAngularModule} from 'lucide-angular';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  imports: [
    NgClass,
    RouterLink, LucideAngularModule
  ],
  standalone: true,
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent {
  menuOpen = false;
  isDarkMode = false;

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
  }

  toggleTheme() {
    this.isDarkMode = !this.isDarkMode;
    document.documentElement.setAttribute(
      'data-theme',
      this.isDarkMode ? 'dark' : 'light'
    );
  }

  closeMenu() {
    this.menuOpen = false;
  }

  protected readonly ROUTES = ROUTES;
}
