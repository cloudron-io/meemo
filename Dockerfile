FROM cloudron/base:4.2.0@sha256:46da2fffb36353ef714f97ae8e962bd2c212ca091108d768ba473078319a47f4

RUN mkdir -p /app/code
WORKDIR /app/code

ARG VERSION=1.13.0

ADD src/ /app/code/src/
ADD frontend/ /app/code/frontend/
ADD gulpfile.js package.json package-lock.json app.js start.sh things.json logo.png logo.svg /app/code/

RUN npm install && npm install -g gulp-cli && gulp default --revision ${VERSION}

CMD [ "/app/code/start.sh" ]
