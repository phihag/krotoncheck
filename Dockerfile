FROM node:11-stretch

WORKDIR /krotoncheck
ADD package.json package-lock.json ./
RUN npm install
ADD . .

EXPOSE 3002
CMD make run
