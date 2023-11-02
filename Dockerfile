FROM cloudron/base:4.0.0@sha256:31b195ed0662bdb06a6e8a5ddbedb6f191ce92e8bee04c03fb02dd4e9d0286df

RUN mkdir -p /app/code
WORKDIR /app/code

ARG VERSION=1.13.0

ADD src/ /app/code/src/
ADD frontend/ /app/code/frontend/
ADD gulpfile.js package.json package-lock.json app.js start.sh things.json logo.png logo.svg /app/code/

RUN npm install && npm install -g gulp-cli && gulp default --revision ${VERSION}

CMD [ "/app/code/start.sh" ]
