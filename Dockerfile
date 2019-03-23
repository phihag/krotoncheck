FROM node:11-stretch

WORKDIR /krotoncheck
ADD package.json package-lock.json ./
RUN npm install
ADD . .

ADD config.json.example config.json

EXPOSE 3002
CMD make run
