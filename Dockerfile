FROM ubuntu:18.04

RUN add-apt-repository ppa:jonathonf/ffmpeg-4 && \
    apt-get update && \
    apt-get install -y \
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
    libwavpack-dev \
    ffmpeg \
    libsox-fmt-all

RUN curl -sL https://deb.nodesource.com/setup_8.x | bash - && \
    apt-get update && \
    apt-get install -y nodejs && \
    npm install -g bower && \
    wget -O /tmp/sox-14.4.2.tar.gz https://jztkft.dl.sourceforge.net/project/sox/sox/14.4.2/sox-14.4.2.tar.gz && \
    tar xzf /tmp/sox-14.4.2.tar.gz -C /tmp && \
    wget -O /tmp/libogg-1.3.4.tar.gz https://ftp.osuosl.org/pub/xiph/releases/ogg/libogg-1.3.4.tar.gz && \
    tar xzf /tmp/libogg-1.3.4.tar.gz -C /tmp && \
    wget -O /tmp/libvorbis-1.3.6.tar.gz https://ftp.osuosl.org/pub/xiph/releases/vorbis/libvorbis-1.3.6.tar.gz && \
    tar xzf /tmp/libvorbis-1.3.6.tar.gz -C /tmp && \
    wget -O /tmp/flac-1.3.2.tar.xz https://ftp.osuosl.org/pub/xiph/releases/flac/flac-1.3.2.tar.xz && \
    tar xf /tmp/flac-1.3.2.tar.xz -C /tmp && \
    wget -O /tmp/vorbis-tools-1.4.0.tar.gz https://ftp.osuosl.org/pub/xiph/releases/vorbis/vorbis-tools-1.4.0.tar.gz && \
    tar xf /tmp/vorbis-tools-1.4.0.tar.gz -C /tmp 

WORKDIR /tmp/libogg-1.3.4
RUN ./configure && \
    make && \
    make install

WORKDIR /tmp/libvorbis-1.3.6
RUN ./configure && \
    make && \
    make install

WORKDIR /tmp/vorbis-tools-1.4.0
RUN ./configure && \
    make && \
    make install

WORKDIR /tmp/flac-1.3.2
RUN ./configure && \
    make && \
    make install

WORKDIR /tmp/sox-14.4.2/
RUN ./configure --with-opus=yes  --with-flac=yes --with-oggvorbis=yes && \
    make -s && \
    make install && \
    ln -s /usr/local/bin/sox /usr/bin/sox && \
    ln -s /usr/local/bin/sox /usr/bin/soxi && \
    rm -rf /var/lib/apt/lists/* /tmp/*

WORKDIR /app
ADD . /app

RUN npm i && bower i --allow-root
RUN ./node_modules/.bin/gulp build

# Alternative default config that will work with docker-compose
RUN cp config/db.docker.json config/db.json

EXPOSE 3000 3001
CMD ["node", "bin/www"]