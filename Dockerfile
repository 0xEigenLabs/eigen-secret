FROM node:18-alpine

MAINTAINER EigenLabs

EXPOSE 3000

WORKDIR /eigen-secret
COPY . /eigen-secret
RUN npm install forever -g && npm install && npm run build && cd server

CMD ["forever", "./dist/app.js"]
