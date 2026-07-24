# Jobs

FROM node:18.14.0 as build
WORKDIR /app
COPY ["jobs/package.json", "jobs/package-lock.json*", "/app/"]
# The vendored @rfcx/notification-templates (file: dep) must exist before
# `npm install` can resolve it.
COPY jobs/vendor /app/vendor
RUN npm install
COPY jobs /app/jobs

# -- arbimon-recording-delete-job --
FROM build as arbimon-recording-delete-job
# jobs/db/index.js requires jobs/db/pg.js (exports PG backend, #1770) which
# requires app/utils/dbpool-pg (the P6 translator). This stage never copied
# app/utils, so the 2026-07-23 rebuild crashed at require-time
# (MODULE_NOT_FOUND) and the daily delete cron failed. Copy app/utils like
# the export-job stage does (dbpool-pg itself needs only crypto + the pg
# package already present in jobs/package.json; it is INERT without
# DB_ENGINE=pg/shadow).
RUN mkdir -p /app/app/utils
COPY app/utils /app/app/utils
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
RUN mkdir -p /app/k8s/job
COPY app/k8s/job /app/app/k8s/job
COPY app/k8s/index.js /app/app/k8s/index.js
COPY app/model/recordings.js /app/app/model/recordings.js
COPY app/model/soundscapes.js /app/app/model/soundscapes.js
COPY app/model/clustering-jobs.js /app/app/model/clustering-jobs.js
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
RUN apt update \
    && apt install -y \
        curl \
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
        pkg-config \
        libflac-dev \
        autoconf \
        automake
# The PM / soundscape / template export paths write intermediate CSVs to
# jobs/arbimon-recording-export-job/tmpfilecache/ but (unlike the index.js
# paths) do not create it, so the job crashed with ENOENT once it actually ran.
# Pre-create it in the image.
RUN mkdir -p /app/jobs/arbimon-recording-export-job/tmpfilecache
CMD ["node", "--max-old-space-size=8192", "jobs/arbimon-recording-export-job/index.js"]

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
