FROM node:11-stretch

WORKDIR /krotoncheck
RUN apt-get update && apt-get install -y tzdata && rm -rf /var/lib/apt/lists/*
ADD package.json package-lock.json ./
RUN npm install
ADD . .

EXPOSE 3002
CMD make run
