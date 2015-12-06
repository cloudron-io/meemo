FROM cloudron/base:0.8.0
MAINTAINER Johannes Zellner <johannes@nebulon.de>

EXPOSE 3000

RUN mkdir -p /app/code
WORKDIR /app/code

ADD bower.json package.json app.js src start.sh /app/code/

ENV PATH /usr/local/node-4.2.1/bin:$PATH

RUN npm install
RUN npm install -g bower
RUN bower install --allow-root

CMD [ "/app/code/start.sh" ]
