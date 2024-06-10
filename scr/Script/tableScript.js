document.addEventListener('DOMContentLoaded', () => {
    const projects = {
        'Web': [
            {
                date: 'Décembre 2022',
                name: 'Silk Path',
                description: 'Site web en html, css et javascript réalisé en groupe de 4 pour faire un le visuel d\'un site de vente responsive.',
                gitLink: 'https://github.com/Calixteair/Silkpath',
                liveLink: 'https://tgoussot.github.io/Project_Silk_Path/'
            },
            {
                date: '2023',
                name: 'SAE345',
                description: 'Site web en FLask de E-commerce pour vendre des meubles en ligne.',
            },
            {
                date: '2023-2024',
                name: 'Belforaine',
                description: 'Application web en Vue.js pour gerer l\'organisation d\'une fête foraine (fictive) réaliser en groupe de 5.',
                gitLink: 'https://github.com/Calixteair/Belforaine',
                liveLink: 'https://codeky.fr'
            },
            {
                date: '2024',
                name: 'heroes and villains',
                description: 'Front-end d\'un site web en vue.js realisé en groupe de 2 et hebergé sur mon VPS.',
                gitLink: 'https://github.com/Calixteair/herosvilains',
                liveLink: 'https://hv.calixteair.fr'
            }
        ],
        'C': [
            {
                date: '2021',
                name: 'Jeu de Dame',
                description: 'Jeu de Dame en C realisé seul',
                gitLink: 'https://github.com/Calixteair/jeu-de-dame',
            }
        ],
        'C++': [
            {
                date: '2024',
                name: 'Démineur',
                description: 'Démineur en C++ realisé en groupe de deux',
                gitLink: 'https://github.com/Calixteair/demineur',
            }
            ],
        'Java': [
            {
                date: '2022',
                name: 'StuckWin',
                description: 'Jeu de plateau ou est de bloquer ses pions pour gagner. réalisé seul',
                gitLink: 'https://github.com/calixteair/StuckWin',
            },
            {
                date: '2024-...',
                name: 'AutoMine',
                description: 'Mod minecraft afin de faire automatiquement des taches répétitives (projet en cours)',
                gitLink: 'https://github.com/calixteair/AutoMine',
            },
            {
                date: '2023',
                name: 'Brandhub',
                description: 'Jeu de plateau Brandhub fais avex javaFX en groupe de 4',
                gitLink: 'https://github.com/calixteair/Brandhub',
            },
            ],
        'Swift': [
            {
                date: '2024',
                name: 'Application d\'habitude',
                description: 'Application pour gerer ses habitudes et les suivres. realisé en groupe de 2',
                gitLink: 'https://github.com/calixteair/productive',
            }
                ]

    };

    const container = document.getElementById('projects-container');

    for (const [language, projectsList] of Object.entries(projects)) {
        const section = document.createElement('section');

        const header = document.createElement('h2');
        header.textContent = language;
        section.appendChild(header);

        const table = document.createElement('table');

        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        const headers = ['Date', 'Nom', 'Description', 'Lien Git', 'Lien Hébergé'];
        headers.forEach(text => {
            const th = document.createElement('th');
            th.textContent = text;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        projectsList.forEach(project => {
            const row = document.createElement('tr');

            const dateCell = document.createElement('td');
            dateCell.textContent = project.date;
            row.appendChild(dateCell);

            const nameCell = document.createElement('td');
            nameCell.textContent = project.name;
            row.appendChild(nameCell);

            const descriptionCell = document.createElement('td');
            descriptionCell.textContent = project.description;
            row.appendChild(descriptionCell);

            const gitLinkCell = document.createElement('td');
            const gitLink = document.createElement('a');
            gitLink.href = project.gitLink;
            gitLink.textContent = 'GitHub';
            gitLinkCell.appendChild(gitLink);
            row.appendChild(gitLinkCell);

            const liveLinkCell = document.createElement('td');
            const liveLink = document.createElement('a');
            liveLink.href = project.liveLink;
            liveLink.textContent = 'Voir le projet';
            if(!project.liveLink) {
                liveLink.textContent = 'Non disponible';
                liveLink.style.color = 'grey';
                liveLink.href = '#';
                //le rendre non cliquable
                liveLink.onclick = (e) => {
                    e.preventDefault();
                };
            }
            liveLinkCell.appendChild(liveLink);
            row.appendChild(liveLinkCell);

            tbody.appendChild(row);
        });

        table.appendChild(tbody);
        section.appendChild(table);
        container.appendChild(section);
    }
});
