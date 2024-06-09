# Dockerfile
FROM nginx:alpine

# Copier les fichiers HTML, CSS et JS dans le répertoire de Nginx
COPY scr/HTML /usr/share/nginx/html
COPY scr/Style /usr/share/nginx/html/Style
COPY scr/Script /usr/share/nginx/html/Script
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN chown -R nginx:nginx /usr/share/nginx/html
CMD ["nginx", "-g", "daemon off;"]
