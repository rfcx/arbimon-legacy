FROM node:14.17.4 as arbimon-recording-delete-job
WORKDIR /app
COPY ["package.json", "package-lock.json*", "./"]
RUN npm install
COPY . .
CMD ["node", "jobs/arbimon-recording-delete-job/index.js"]
