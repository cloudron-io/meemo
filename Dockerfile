FROM cloudron/base:0.8.0
MAINTAINER Johannes Zellner <johannes@nebulon.de>

EXPOSE 3000

RUN mkdir -p /app/code
WORKDIR /app/code

ADD bower.json package.json app.js src start.sh /app/code
