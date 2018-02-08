FROM cloudron/base:0.10.0

RUN mkdir -p /app/code
WORKDIR /app/code

ENV PATH /usr/local/node-6.9.5/bin:$PATH

ADD src/ /app/code/src/
ADD frontend/ /app/code/frontend/
ADD gulpfile.js package.json app.js start.sh things.json logo.png /app/code/

RUN npm install && npm install -g gulp-cli && gulp default

CMD [ "/app/code/start.sh" ]
