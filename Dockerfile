#FROM node:12.22.5-alpine3.14
FROM ubuntu:20.04
RUN apt-get update \
  && apt-get install -y curl gnupg build-essential wget \
  && curl --silent --location https://deb.nodesource.com/setup_18.x | bash - \
  && curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add - \
  && apt-get remove -y --purge cmdtest \
  && apt-get update \
  # remove useless files from the current layer
  && rm -rf /var/lib/apt/lists/* \
  && rm -rf /var/lib/apt/lists.d/* \
  && apt-get autoremove \
  && apt-get clean \
  && apt-get autoclean

MAINTAINER Eigen

EXPOSE 3000

WORKDIR /app
COPY . /app
RUN npm install forever -g && npm install && npm run build

CMD ["forever", "build/src/app.js"]
