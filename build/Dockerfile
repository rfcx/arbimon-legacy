# Jobs

FROM node:18.14.0 as build
WORKDIR /app
COPY ["jobs/package.json", "jobs/package-lock.json*", "/app/"]
RUN npm install
COPY jobs /app/jobs

# -- arbimon-recording-delete-job --
FROM build as arbimon-recording-delete-job
CMD ["node", "jobs/arbimon-recording-delete-job/index.js"]

# -- arbimon-export-recording-job --
FROM build as arbimon-export-recording-job
CMD ["node", "jobs/arbimon-export-recording-job/index.js"]

# ---

# Frontend and backend

FROM ubuntu:18.04 as arbimon
RUN apt update \
    && apt install -y \
        curl \
        gnupg \
        gcc \
        g++ \
        make \
        sox \
        imagemagick \
        python-dev \
        software-properties-common \
        libsox-fmt-all \
        libsox-dev \
        libvorbis-dev \
        libogg-dev \
        vorbis-tools \
        libopus-dev \
        libopusfile-dev \
        libtool \
        opus-tools \
        pkg-config \
        libflac-dev \
        autoconf \
        automake \
        git \
        virtualenv \
        libpng-dev \
        libfreetype6-dev \
        libmysqlclient-dev
RUN curl -sL https://deb.nodesource.com/setup_16.x | bash - && \
        apt update && \
        apt install -y nodejs

WORKDIR /app
COPY requirements.txt /app/
RUN virtualenv --python=$(which python2) .env && . .env/bin/activate && \
    pip2 install -r requirements.txt && \
    echo `realpath lib` > .env/lib/python2.7/site-packages/arbimon-server-libs.pth

COPY *.js* /app/
RUN npm i

COPY app /app/app
COPY assets /app/assets
COPY bin /app/bin
COPY config /app/config
COPY lib /app/lib
COPY public /app/public
COPY scripts /app/scripts
RUN ./node_modules/.bin/gulp build

EXPOSE 3000
ENTRYPOINT ["node", "bin/www"]
