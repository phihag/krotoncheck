FROM node:17-bullseye

WORKDIR /krotoncheck
RUN apt-get update && apt-get install -y tzdata && rm -rf /var/lib/apt/lists/*
ADD package.json package-lock.json ./
RUN npm ci
ADD . .

EXPOSE 3002
CMD make run
