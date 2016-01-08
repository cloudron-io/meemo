FROM cloudron/base:0.8.0
MAINTAINER Johannes Zellner <johannes@nebulon.de>

EXPOSE 3000

RUN mkdir -p /app/code
WORKDIR /app/code

ADD src/ /app/code/src/
ADD frontend/ /app/code/frontend/
ADD chrome_extension.crx gulpfile.js package.json app.js start.sh things.json logo.png /app/code/

ENV PATH /usr/local/node-4.2.1/bin:$PATH

RUN npm install
RUN npm install -g gulp-cli
RUN gulp default

CMD [ "/app/code/start.sh" ]
