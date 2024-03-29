FROM node:18-alpine

MAINTAINER EigenLabs

EXPOSE 3000

WORKDIR /eigen-secret
COPY . /eigen-secret

# https://github.com/sequelize/sequelize/issues/11174
RUN npm install forever -g && npm install && npm run build

#CMD ["forever", "./server/dist/app.js"]
CMD ["script/entrypoint.sh"]
