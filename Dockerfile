FROM cloudron/base:1.0.0@sha256:147a648a068a2e746644746bbfb42eb7a50d682437cead3c67c933c546357617

RUN mkdir -p /app/code
WORKDIR /app/code

ADD src/ /app/code/src/
ADD frontend/ /app/code/frontend/
ADD gulpfile.js package.json package-lock.json app.js start.sh things.json logo.png /app/code/

RUN npm install && npm install -g gulp-cli && gulp default --revision 1.9.0

CMD [ "/app/code/start.sh" ]
