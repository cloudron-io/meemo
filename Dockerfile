FROM cloudron/base:5.0.0@sha256:04fd70dbd8ad6149c19de39e35718e024417c3e01dc9c6637eaf4a41ec4e596c

RUN mkdir -p /app/code
WORKDIR /app/code

ARG VERSION=1.13.0

ADD src/ /app/code/src/
ADD frontend/ /app/code/frontend/
ADD gulpfile.js package.json package-lock.json app.js start.sh things.json logo.png logo.svg /app/code/

RUN npm install --no-update-notifier && \
    npm install -g gulp-cli && \
    gulp default --revision ${VERSION}

CMD [ "/app/code/start.sh" ]
