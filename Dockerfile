FROM node:18-alpine AS build

WORKDIR /usr/src/etibe

COPY package.json  yarn.lock ./

RUN npm install --legacy-peer-deps --omit=dev

RUN npm install -g @dolphjs/cli @swc/core @swc/cli && \
    npm cache clean --force && \
    rm -rf /tmp/*

COPY . .

RUN npm run build

# Stage 2

FROM node:18-alpine

WORKDIR /usr/src/etibe

COPY --from=build /usr/src/etibe .

COPY --from=build /usr/local/lib/node_modules /usr/local/lib/node_modules
COPY --from=build /usr/local/bin /usr/local/bin

ENV PATH /usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

EXPOSE 3003

CMD [ "npm", "start" ]
