FROM node:18-alpine

MAINTAINER EigenLabs

EXPOSE 3000

WORKDIR /eigen-secret
COPY . /eigen-secret

# https://github.com/sequelize/sequelize/issues/11174
RUN npm install forever -g && npm i -g sqlite3 && npm i -g mysql2 && npm install && npm run build

CMD ["forever", "./server/dist/app.js"]
