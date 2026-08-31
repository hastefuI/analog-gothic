# Development image for the Analog Gothic icon kit.

FROM node:24-alpine

RUN apk add --no-cache make

RUN npm install -g browser-sync

RUN mkdir -p /app && chown node:node /app
WORKDIR /app
USER node

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci

EXPOSE 3000
CMD ["make", "help"]
