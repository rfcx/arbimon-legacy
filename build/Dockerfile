# Jobs

FROM node:14.17.4 as arbimon-recording-delete-job
WORKDIR /app
COPY ["jobs/package.json", "jobs/package-lock.json*", "/app/"]
RUN npm install
COPY jobs /app/jobs
CMD ["node", "jobs/arbimon-recording-delete-job/index.js"]

# Frontend and backend

FROM ubuntu:18.04 as arbimon
RUN apt-get update && apt-get install --no-install-recommends -y \
    curl sox \
    git g++ software-properties-common imagemagick \ 
    python-dev virtualenv pkg-config libpng-dev libfreetype6-dev libmysqlclient-dev

RUN set -x \
    && curl -sL 'https://deb.nodesource.com/setup_8.x' | bash - \
    && apt-get -y install nodejs \
    && ln -s /usr/bin/nodejs /usr/local/bin/node

# RUN curl http://downloads.sourceforge.net/project/sox/sox/14.4.2/sox-14.4.2.tar.gz -L --output /tmp/sox-14.4.2.tar.gz --silent && \
#     tar xzf /tmp/sox-14.4.2.tar.gz -C /tmp && \
#     cd /tmp/sox-14.4.2 && \
#     ./configure --with-opus=yes  --with-flac=yes --with-oggvorbis=yes && \
#     make -s && make install && \
#     ln -s /usr/local/bin/sox /usr/bin/sox && ln -s /usr/local/bin/sox /usr/bin/soxi && \
#     rm -rf /tmp/*

WORKDIR /app
COPY requirements.txt /app/
RUN virtualenv --python=$(which python2) .env && . .env/bin/activate && \
    pip2 install -r requirements.txt && \
    echo `realpath lib` > .env/lib/python2.7/site-packages/arbimon-server-libs.pth

COPY app /app/app
COPY assets /app/assets
COPY bin /app/bin
COPY config /app/config
COPY lib /app/lib
COPY public /app/public
COPY scripts /app/scripts
COPY *.js* /app/
RUN npm set unsafe-perm true && npm i
RUN ./node_modules/.bin/gulp build

EXPOSE 3000
CMD ["node", "bin/www"]
