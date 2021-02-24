FROM cloudron/base:3.0.0@sha256:455c70428723e3a823198c57472785437eb6eab082e79b3ff04ea584faf46e92

RUN mkdir -p /app/code
WORKDIR /app/code

ARG VERSION=1.13.0

ADD src/ /app/code/src/
ADD frontend/ /app/code/frontend/
ADD gulpfile.js package.json package-lock.json app.js start.sh things.json logo.png /app/code/

RUN npm install && npm install -g gulp-cli && gulp default --revision ${VERSION}

CMD [ "/app/code/start.sh" ]
