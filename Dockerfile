# Development image for the Analog Gothic icon kit.
#
# Runs every build target without Node.js installed on the host. Release
# targets deliberately stay on the host, since signing commits and tags
# needs the maintainer's GPG key.

FROM node:24-alpine

# make drives every build step and the base image does not ship it.
RUN apk add --no-cache make

# browser-sync serves the live-reload preview. It is only ever needed in
# the container, so it stays out of package.json.
RUN npm install -g browser-sync

# Own the workdir as the unprivileged user that the base image provides,
# so files written into the bind mount are not root owned.
RUN mkdir -p /app && chown node:node /app
WORKDIR /app
USER node

# Install dependencies as their own layer so it caches across source edits.
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci

# Sources are bind mounted at run time, so nothing else is copied in.

EXPOSE 3000
CMD ["make", "help"]
