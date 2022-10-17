FROM node:14.17.4 as arbimon-recording-delete-job
WORKDIR /app
COPY ["jobs/arbimon-recording-delete-job/package.json", "jobs/arbimon-recording-delete-job/package-lock.json*", "/app/"]
RUN npm install
COPY jobs /app/jobs
CMD ["node", "jobs/arbimon-recording-delete-job/index.js"]
