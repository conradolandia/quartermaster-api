# Stage 0, "build-stage", based on Node.js, to build and compile the frontend
FROM node:20 AS build-stage

WORKDIR /app

COPY package*.json /app/

RUN npm install

COPY ./ /app/

ARG VITE_API_URL=${VITE_API_URL}
ARG VITE_PUBLIC_BOOKING_BASE_URL=${VITE_PUBLIC_BOOKING_BASE_URL}
ARG VITE_STRIPE_PUBLISHABLE_KEY
ARG VITE_DEBUG_LOG_ENABLED=false
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_PUBLIC_BOOKING_BASE_URL=$VITE_PUBLIC_BOOKING_BASE_URL
ENV VITE_STRIPE_PUBLISHABLE_KEY=$VITE_STRIPE_PUBLISHABLE_KEY
ENV VITE_DEBUG_LOG_ENABLED=$VITE_DEBUG_LOG_ENABLED

RUN npm run build


# Stage 1, based on Nginx, to have only the compiled app, ready for production with Nginx
FROM nginx:1

COPY --from=build-stage /app/dist/ /usr/share/nginx/html

COPY ./nginx.conf /etc/nginx/conf.d/default.conf
COPY ./nginx-backend-not-found.conf /etc/nginx/extra-conf.d/backend-not-found.conf
