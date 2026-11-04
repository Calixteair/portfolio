// CI/CD du portfolio, exécutée par Jenkins (jenkins.calixteair.fr) avec la bibliothèque partagée
// calixteair (dépôt jenkins-lib) : lint, tests, build, budget de taille, e2e, gitleaks et Snyk,
// image + Trivy, publication sur Harbor.
//
//   PR               → tout est testé et construit, rien n'est publié
//   main             → images web-sha-<commit> et web-latest, sans déploiement
//   tag vX.Y.Z signé → image vX.Y.Z-web (immuable), puis déploiement : le VPS (stack-sync) vérifie la
//                      signature du tag, épingle l'image et installe deploy/compose.yaml
@Library('calixteair@v1') _

// pnpm du projet (packageManager) activé par corepack, dans /tmp : l'agent n'est pas root
String pnpm = 'mkdir -p /tmp/bin && corepack enable --install-directory /tmp/bin && export PATH=/tmp/bin:$PATH'

standardPipeline(
  test: [
    // Node du projet (.nvmrc), cache pnpm hors du workspace (sinon prettier le contrôle)
    [image: 'node:24.22.0-alpine3.24',
     args: '-e HOME=/tmp -e COREPACK_HOME=/tmp/corepack -e npm_config_store_dir=/tmp/pnpm-store -e CI=1',
     command: "${pnpm} && pnpm install --frozen-lockfile && pnpm run lint && pnpm test && pnpm run build && pnpm run size"],
    // Navigateurs de l'image Playwright (version de @playwright/test), sur les node_modules déjà installés
    [image: 'mcr.microsoft.com/playwright:v1.64.1-noble', args: '-e HOME=/tmp -e CI=1',
     command: './node_modules/.bin/playwright test'],
  ],
  registry: [url: 'registry.calixteair.fr/portfolio', bao: 'cicd/harbor/portfolio'],
  images: [[name: 'portfolio', tagPrefix: 'web']],
  heavy: false,
  signedReleases: true,
  deploy: [stack: 'portfolio', url: 'https://portfolio.calixteair.fr/'],
)
