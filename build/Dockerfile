FROM node:14.17.4 as arbimon-recording-delete-job
WORKDIR /app
COPY ["jobs/package.json", "jobs/package-lock.json*", "/app/"]
RUN npm install
COPY jobs /app/jobs
CMD ["node", "jobs/arbimon-recording-delete-job/index.js"]

# FROM 887044485231.dkr.ecr.eu-west-1.amazonaws.com/arbimon/base:v0.0.1 as arbimon
FROM ubuntu:18.04 as arbimon

RUN apt-get update && \
    apt-get install --no-install-recommends -y \
    curl \
    wget \
    gnupg \
    gcc \
    g++ \
    make \
    pngcrush \
    imagemagick \
    python-minimal \
    software-properties-common \
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
    libvorbis-ocaml \
    libpng-tools \
    libpng-dev \
    libmagic-dev \
    libsndfile1-dev \
    libmp3lame-dev \
    libwavpack-dev

RUN  add-apt-repository ppa:jonathonf/ffmpeg-4 && \
     apt update && \
     apt install -y  ffmpeg libsox-fmt-all && \
     curl -sL https://deb.nodesource.com/setup_16.x | bash - && \
     apt update && \
     apt install -y nodejs && \
     npm install -g bower && \
     curl -o /tmp/libogg-1.3.4.tar.gz https://ftp.osuosl.org/pub/xiph/releases/ogg/libogg-1.3.4.tar.gz && \
     tar xzf /tmp/libogg-1.3.4.tar.gz -C /tmp && \
     curl -o /tmp/libvorbis-1.3.7.tar.gz https://ftp.osuosl.org/pub/xiph/releases/vorbis/libvorbis-1.3.7.tar.gz && \
     tar xzf /tmp/libvorbis-1.3.7.tar.gz -C /tmp && \
     curl -o /tmp/vorbis-tools-1.4.2.tar.gz https://ftp.osuosl.org/pub/xiph/releases/vorbis/vorbis-tools-1.4.2.tar.gz && \
     tar xf /tmp/vorbis-tools-1.4.2.tar.gz -C /tmp && \
     curl -o /tmp/flac-1.3.2.tar.xz https://ftp.osuosl.org/pub/xiph/releases/flac/flac-1.3.2.tar.xz && \
     tar xf /tmp/flac-1.3.2.tar.xz -C /tmp

WORKDIR /tmp/libogg-1.3.4
RUN ./configure && make && make install

WORKDIR /tmp/libvorbis-1.3.7
RUN ./configure && make && make install

WORKDIR /tmp/vorbis-tools-1.4.2
RUN ./configure && make && make install

WORKDIR /tmp/flac-1.3.2
RUN ./configure && make && make install

ENV SOX_PATH="/usr/bin/sox"
ENV FFMPEG_PATH="/usr/bin/ffmpeg"
ENV IMAGEMAGICK_PATH="/usr/bin/convert"
ENV PNGCRUSH_PATH="/usr/bin/pngcrush"

RUN mkdir -p /tmpfilecache

WORKDIR /app
COPY . /app
RUN npm i && bower i --allow-root

CMD ["npm", "run", "dev"]
