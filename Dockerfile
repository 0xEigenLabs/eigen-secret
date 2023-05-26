FROM node:18-alpine

MAINTAINER Eigen

EXPOSE 3000

WORKDIR /app
COPY . /app
RUN npm install forever -g && npm install && npm run build

CMD ["forever", "build/src/app.js"]
