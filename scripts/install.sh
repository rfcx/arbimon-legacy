#! /bin/sh

# OUTDATED

sudo apt-get install -y libcap2-bin git

repo="chris-lea/node.js"
repoppa="ppa:$repo"

if ! (grep ^ /etc/apt/sources.list /etc/apt/sources.list.d/* | grep -v list.save | grep -v deb-src | cut -d "#" -f 1 | grep -q $repo); then 
    sudo add-apt-repository $repoppa
fi

sudo apt-get update
sudo apt-get install -y python-pip sox libsox-fmt-mp3 imagemagick nodejs libmysqlclient-dev python-dev libpng12-dev libfreetype6-dev python-virtualenv
sudo setcap cap_net_bind_service=+ep /usr/bin/nodejs
sudo npm install -g grunt-cli
sudo npm install -g bower
sudo npm install -g forever

U=`whoami`
H=`readlink -f ~/.npm`
sudo chown -R "$U" "$H"

npm run-script setup
