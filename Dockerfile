# Dockerfile
FROM nginx:alpine

# Copier les fichiers HTML, CSS et JS dans le répertoire de Nginx
COPY scr/ /usr/share/nginx/html
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN chown -R nginx:nginx /usr/share/nginx/html
CMD ["nginx", "-g", "daemon off;"]
