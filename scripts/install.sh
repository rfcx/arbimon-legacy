#! /bin/sh

sudo apt-get install libcap2-bin git
sudo add-apt-repository ppa:chris-lea/node.js
sudo apt-get update
sudo apt-get install python-pip sox libsox-fmt-mp3 imagemagick nodejs libmysqlclient-dev python-dev gfortran libopenblas-dev liblapack-dev  libpng12-dev libfreetype6-dev libsndfile1 libsndfile-dev python-virtualenv r-base r-base-dev libfftw3-3 libfftw3-dev r-cran-rgl bwidget
sudo scripts/setup/r-packages.R
sudo setcap cap_net_bind_service=+ep /usr/bin/nodejs
sudo npm install -g grunt-cli
sudo npm install -g bower
sudo npm install -g forever

npm run-script setup
