# Jobs

FROM node:18.14.0 as build
WORKDIR /app
COPY ["jobs/package.json", "jobs/package-lock.json*", "/app/"]
RUN npm install
COPY jobs /app/jobs

# -- arbimon-recording-delete-job --
FROM build as arbimon-recording-delete-job
CMD ["node", "jobs/arbimon-recording-delete-job/index.js"]

# -- arbimon-recording-export-job --
FROM build as arbimon-recording-export-job
RUN mkdir -p /config
COPY config/ /app/config
RUN mkdir -p /app
COPY app/config.js /app/app/config.js
RUN mkdir -p /app/utils
COPY app/utils /app/app/utils
RUN mkdir -p /app/model
COPY app/model/recordings.js /app/app/model/recordings.js
COPY app/model/projects.js /app/app/model/projects.js
COPY app/model/users.js /app/app/model/users.js
COPY app/model/auth0.js /app/app/model/auth0.js
COPY app/model/species.js /app/app/model/species.js
COPY app/model/songtypes.js /app/app/model/songtypes.js
COPY app/model/roles.js /app/app/model/roles.js
COPY app/model/tags.js /app/app/model/tags.js
COPY app/model/soundscape-composition.js /app/app/model/soundscape-composition.js
COPY app/model/sites.js /app/app/model/sites.js
COPY app/model/classifications.js /app/app/model/classifications.js
CMD ["node", "--max_old_space_size=4096", "jobs/arbimon-recording-export-job/index.js"]

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
