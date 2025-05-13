import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {NavbarComponent} from './components/navbar/navbar.component';
import {SocialIconsComponent} from './components/social-icons/social-icons.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavbarComponent, SocialIconsComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'portfolio';

  toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
  }
}
