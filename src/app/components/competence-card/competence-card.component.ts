import {Component, Input} from '@angular/core';
import {CommonModule} from '@angular/common';
import {Competence} from '../../models/competence.model';
import {ROUTES} from "../../paths";
import {Router, RouterLink} from "@angular/router";

@Component({
    selector: 'app-competence-card',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './competence-card.component.html',
    styleUrls: ['./competence-card.component.scss']
})
export class CompetenceCardComponent {
    @Input() competence?: Competence;

    hover = false;

    constructor(private router: Router) {
    }

    protected readonly ROUTES = ROUTES;

    getTraceRoute(): string {
        if (this.competence?.idTrace) {
            const key = `TRACE${this.competence.idTrace}` as keyof typeof ROUTES;
            return ROUTES[key];
        }
        return '/';
    }
}
