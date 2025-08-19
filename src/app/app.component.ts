import {Component, ElementRef, Inject, NgZone, PLATFORM_ID, ViewChild} from '@angular/core';
import {NavigationEnd, Router, RouterOutlet} from '@angular/router';
import {NavbarComponent} from './components/navbar/navbar.component';
import {SocialIconsComponent} from './components/social-icons/social-icons.component';
import {gsap} from 'gsap';
import {isPlatformBrowser} from '@angular/common';
import {filter} from 'rxjs';

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

  @ViewChild('bigBall', {static: true}) bigBall!: ElementRef;
  @ViewChild('smallBall', {static: true}) smallBall!: ElementRef;

  private observer!: MutationObserver;
  private hoverables: Element[] = [];
  private boundMouseMove = this.onMouseMove.bind(this);
  private isBrowser: boolean;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private router: Router
  ) {
    this.isBrowser = isPlatformBrowser(platformId);

    // 👇 Après chaque navigation, rebind les effets
    if (this.isBrowser) {
      this.router.events.pipe(
        filter(event => event instanceof NavigationEnd)
      ).subscribe(() => {
        this.rebindCursor();
        this.resetCursorScale();
      });
    }
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;

    document.body.classList.add('cursor-enabled');

    document.body.addEventListener('mousemove', this.boundMouseMove);
    this.observeHoverables();
  }

  observeHoverables(): void {
    this.observer = new MutationObserver(() => {
      this.bindHoverEvents();
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    this.bindHoverEvents();
  }

  bindHoverEvents(): void {
    this.hoverables.forEach(el => {
      el.removeEventListener('mouseenter', this.onMouseHover);
      el.removeEventListener('mouseleave', this.onMouseHoverOut);
    });

    const elements = document.querySelectorAll('.hoverable');
    this.hoverables = Array.from(elements);

    this.hoverables.forEach(el => {
      el.addEventListener('mouseenter', this.onMouseHover.bind(this));
      el.addEventListener('mouseleave', this.onMouseHoverOut.bind(this));
    });
  }

onMouseMove(e: MouseEvent): void {
  if (!this.bigBall?.nativeElement || !this.smallBall?.nativeElement) return;

  // Utiliser clientX/Y pour une position correcte avec le scroll
  const x = e.clientX;
  const y = e.clientY;

  gsap.to(this.bigBall.nativeElement, {
    duration: 0.4,
    x: x - 15,
    y: y - 15
  });
  gsap.to(this.smallBall.nativeElement, {
    duration: 0.1,
    x: x - 5,
    y: y - 7
  });
}

  onMouseHover(): void {
    gsap.killTweensOf(this.bigBall.nativeElement);
    gsap.to(this.bigBall.nativeElement, {duration: 0.3, scale: 4});
    gsap.to(this.smallBall.nativeElement, {duration: 0.3, scale: 2});

  }

  onMouseHoverOut(): void {
    gsap.killTweensOf(this.bigBall.nativeElement);
    gsap.to(this.bigBall.nativeElement, {duration: 0.3, scale: 1});
    gsap.to(this.smallBall.nativeElement, {duration: 0.3, scale: 1});
  }

  ngOnDestroy(): void {
    if (!this.isBrowser) return;

    if (this.observer) {
      this.observer.disconnect();
    }

    document.body.removeEventListener('mousemove', this.boundMouseMove);

    this.hoverables.forEach(el => {
      el.removeEventListener('mouseenter', this.onMouseHover);
      el.removeEventListener('mouseleave', this.onMouseHoverOut);
    });
  }

  rebindCursor() {
    this.bindHoverEvents();
  }

  resetCursorScale() {
    if (this.bigBall?.nativeElement) {
      gsap.to(this.bigBall.nativeElement, {duration: 0.2, scale: 1});
    }
  }
}
