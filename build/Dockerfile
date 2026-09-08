# Jobs

# BASE: node 18 on Debian BOOKWORM (not bullseye).
#
# 2026-09-08: node:18.14.0 is a BULLSEYE image, and bullseye reached EOL --
# `bullseye-security` stopped being republished (its Release froze at
# 2026-08-31 with `Valid-Until: 2026-09-07`) while its pool was cleaned. Every
# build after that expiry fails at the export stage's `apt install`:
#
#   E: Release file for .../bullseye-security/InRelease is expired
#      (invalid since ...). Updates for this repository will not be applied.
#   E: Failed to fetch .../systemd_247.3-7+deb11u8_arm64.deb  404  Not Found
#
# The 404s are the SYMPTOM; the expired InRelease is the cause (apt refuses the
# stale index, then resolves against metadata whose files are gone). This broke
# CD for `arbimon-recording-export-job` on every run from 2026-08-31 onward,
# which is why no export-job image exists for a349c3c or 9ee8225.
#
# WHY BOOKWORM AND NOT TRIXIE: there is no `node:18-trixie` -- trixie ships a
# newer Node, so adopting it forces a Node MAJOR upgrade (18 -> 20/22) and turns
# a build fix into an app migration. Bookworm keeps node 18 (18.14.0 -> 18.20.8,
# a PATCH bump with an IDENTICAL ABI: process.versions.modules == 108 on both),
# is actively republished (oldstable, rolling Valid-Until), and installs this
# file's exact package list at exit 0. The Node major bump + trixie is real work
# that is owed (node 18 is EOL upstream) but belongs in its own PR with app
# testing -- see runbooks/DECISION-2026-09-08-bookworm-vs-trixie-for-arbimon-legacy.md
#
# NOTE: this `build` stage is the parent of BOTH job images
# (arbimon-recording-delete-job AND arbimon-recording-export-job), so a change
# here is validated against both. The `arbimon` web stage below is independent
# (ubuntu:18.04) and is deliberately NOT touched by this change.
FROM node:18-bookworm as build
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
# `python-dev` (python2 dev headers) was REMOVED after bullseye and has no
# installation candidate on bookworm or trixie -- keeping it fails the whole
# `apt install` with "Package 'python-dev' has no installation candidate".
# Nothing in the export path compiles against python2. Dropped 2026-09-08.
RUN apt update \
    && apt install -y \
        curl \
        sox \
        imagemagick \
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
