FROM node:8
RUN npm install -g bower

WORKDIR /app
ADD . /app

RUN npm i && bower i --allow-root
RUN ./node_modules/.bin/gulp build

EXPOSE 3000 3001
CMD ["node", "bin/www"]
