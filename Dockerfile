FROM 887044485231.dkr.ecr.eu-west-1.amazonaws.com/arbimon/base:v0.0.1

WORKDIR /app/
COPY . /app
RUN npm i && bower i --allow-root
RUN ./node_modules/.bin/gulp build

# Alternative default config that will work with docker-compose
RUN cp config/db.docker.json config/db.json

EXPOSE 3000 3001
CMD ["node", "bin/www"]