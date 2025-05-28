import {Component, Input} from '@angular/core';
import {CommonModule} from '@angular/common';
import {Project} from '../../models/project.model';
import {ROUTES} from "../../paths";
import {Router, RouterLink} from "@angular/router";

@Component({
    selector: 'app-project-card',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './project-card.component.html',
    styleUrls: ['./project-card.component.scss']
})
export class ProjectCardComponent {
    @Input() project?: Project;

    hover = false;

    constructor(private router: Router) {
    }


    protected readonly ROUTES = ROUTES;


    getTraceRoute(): string {
        if (this.project?.idTrace) {
            const key = `TRACE${this.project.idTrace}` as keyof typeof ROUTES;
            return ROUTES[key];
        }
        return '/';
    }
}
