FROM 887044485231.dkr.ecr.eu-west-1.amazonaws.com/arbimon/base:v0.0.1

WORKDIR /app/
COPY . /app
RUN npm i && bower i --allow-root
RUN ./node_modules/.bin/gulp build

# Alternative default config that will work with docker-compose
RUN cp config/db.docker.json config/db.json

RUN apt-get update && \
    apt-get install -y python-dev virtualenv pkg-config libpng-dev libfreetype6-dev libmysqlclient-dev && \
    virtualenv .env && \
    . .env/bin/activate && \
    pip install numpy && \
    pip install -r requirements.txt && \
    echo `realpath lib` > .env/lib/python2.7/site-packages/arbimon-server-libs.pth
EXPOSE 3000 3001
CMD ["node", "bin/www"]
