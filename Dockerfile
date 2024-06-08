# Dockerfile
FROM nginx:alpine

# Copier les fichiers HTML, CSS et JS dans le répertoire de Nginx
COPY scr/HTML /usr/share/nginx/html
COPY scr/Style /usr/share/nginx/html/Style
COPY scr/Script /usr/share/nginx/html/Script

# Supprimez la configuration par défaut de Nginx et utilisez une configuration personnalisée si nécessaire
# COPY nginx.conf /etc/nginx/conf.d/default.conf  # Uncomment and customize if you have a custom nginx config

# Expose port 80
EXPOSE 8083

# Commande pour lancer Nginx
CMD ["nginx", "-g", "daemon off;"]
