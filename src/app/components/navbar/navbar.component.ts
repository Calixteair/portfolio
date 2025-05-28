import {Component} from '@angular/core';
import {NgClass} from '@angular/common';
import {RouterLink, RouterLinkActive} from '@angular/router';
import {ROUTES} from '../../paths';
import {LucideAngularModule} from "lucide-angular";
import {faCrosshairs, faSlash} from '@fortawesome/free-solid-svg-icons';

@Component({
    selector: 'app-navbar',
    templateUrl: './navbar.component.html',
    imports: [
        NgClass,
        RouterLink,
        LucideAngularModule
    ],
    standalone: true,
    styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent {
    menuOpen = false;
    isDarkMode = false;
    cursorEnabled = true;


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

    faCrosshairs = faCrosshairs;
    faSlash = faSlash;


  toggleCursorEffect() {
    this.cursorEnabled = !this.cursorEnabled;

    if (this.cursorEnabled) {
      document.body.classList.add('cursor-enabled');
      document.body.classList.remove('cursor-disabled');
    } else {
      document.body.classList.remove('cursor-enabled');
      document.body.classList.add('cursor-disabled');
    }
  }

    protected readonly ROUTES = ROUTES;
}
