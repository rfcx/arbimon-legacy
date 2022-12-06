FROM node:14.17.4 as arbimon-recording-delete-job
WORKDIR /app
COPY ["jobs/package.json", "jobs/package-lock.json*", "/app/"]
RUN npm install
COPY jobs /app/jobs
CMD ["node", "jobs/arbimon-recording-delete-job/index.js"]

FROM 887044485231.dkr.ecr.eu-west-1.amazonaws.com/arbimon/base:v0.0.1 as arbimon

RUN mkdir -p /tmpfilecache

WORKDIR /app
COPY . /app
RUN npm i && bower i --allow-root
CMD ["npm", "run", "dev"]
