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
    curl git g++ \
    imagemagick \
    software-properties-common \
    libsox-dev \
    libvorbis-dev \
    libogg-dev \
    vorbis-tools \
    libopus-dev \
    libopusfile-dev \
    libtool \
    opus-tools \
    libflac-dev \
    libvorbis-ocaml \
    libpng-tools \
    libmagic-dev \
    libsndfile1-dev \
    libmp3lame-dev \
    libwavpack-dev \
    ffmpeg sox \
    python-dev virtualenv pkg-config libpng-dev libfreetype6-dev libmysqlclient-dev

RUN set -x \
    && curl -sL 'https://deb.nodesource.com/setup_8.x' | bash - \
    && apt-get -y install nodejs \
    && ln -s /usr/bin/nodejs /usr/local/bin/node

WORKDIR /app
# COPY requirements.txt /app/
# RUN virtualenv --python=$(which python2) .env && . .env/bin/activate && \
#     pip2 install -r requirements.txt && \
#     echo `realpath lib` > .env/lib/python2.7/site-packages/arbimon-server-libs.pth

COPY . /app
RUN npm i
RUN ./node_modules/gulp/bin/gulp.js build
RUN ./node_modules/gulp/bin/gulp.js watch

EXPOSE 3000
CMD ["node", "bin/www"]
