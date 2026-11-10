
# Etapa 1: construir la aplicación React
FROM node:20-alpine AS build

WORKDIR /app

# Dirección de la API durante la compilación
ARG REACT_APP_API_URL
ENV REACT_APP_API_URL=$REACT_APP_API_URL

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build


# Etapa 2: servir React mediante Nginx
FROM nginx:alpine

COPY --from=build /app/build /usr/share/nginx/html

# Configuración para React Router
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
