FROM node:lts-alpine

RUN mkdir -p /app/code
WORKDIR /app/code

ARG VERSION=1.13.0

ADD src/ /app/code/src/
ADD frontend/ /app/code/frontend/
ADD gulpfile.js package.json package-lock.json app.js start.sh things.json logo.png /app/code/

RUN npm install && npm install -g gulp-cli && gulp default --revision ${VERSION}

CMD [ "/app/code/start.sh" ]
