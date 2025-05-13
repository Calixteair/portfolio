# Étape 1 : build Angular app
FROM node:18-alpine as builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build --prod

# Étape 2 : Nginx pour servir l'app
FROM nginx:alpine

# Supprimer la config par défaut
RUN rm /etc/nginx/conf.d/default.conf

# Copier la config personnalisée nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copier les fichiers buildés d’Angular dans Nginx
COPY --from=builder /app/dist/* /usr/share/nginx/html

# (optionnel) Droits corrects
RUN chown -R nginx:nginx /usr/share/nginx/html

CMD ["nginx", "-g", "daemon off;"]
