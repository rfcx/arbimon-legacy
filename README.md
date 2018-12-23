# Arbimon II
Bio-Acoustic Analyzer

---
### Quick Setup:
 - install system dependencies all
   ```
   curl -sL https://deb.nodesource.com/setup_0.10 | sudo bash -
   sudo apt-get install -y python-pip sox libsox-fmt-mp3 nodejs libmysqlclient-dev python-dev libpng12-dev libfreetype6-dev python-virtualenv pkg-config
   ```


 - install python dependencies, create python virtualenv
    ```
    sh scripts/setup/010-make_virtual_env.sh
    ```


 - install backend dependencies, frontend dependencies and build the app
    ```
    npm i && bower i
    grunt prod
    ```

 - run app (the app will be available in http://localhost:3000)
    ```
    npm start
    ```


### System dependencies:

 - nodejs 0.10.x
   ```
   curl -sL https://deb.nodesource.com/setup_0.10 | sudo bash -
   sudo apt-get install -y nodejs
   ```

 - python 2.7 - comes with Ubuntu


 - pip - python dependencies
   ```
   sudo apt-get install pip
   or
   sudo apt-get install python-pip
   ```


 - sox - audio conversion
   ```
   sudo apt-get install sox
   sudo apt-get install libsox-fmt-mp3
   ```


 - MySQL-python dependencies
   ```
   sudo apt-get install libmysqlclient-dev python-dev
   ```

 - python virtualenv
   ```
   sudo apt-get install virtualenv
   ```

 - matplotlib dependencies
   ```
   sudo apt-get install libpng12-dev libfreetype6-dev pkg-config
   ```

 - node global dependencies(`sudo npm install -g <package>`):
    - bower
    - grunt-cli


 - individual python dependencies (`sudo pip install`):
    - MySQL-python
    - boto
    - pypng  
    - matplotlib
    - virtualenv

---

### Build for development

install backend and dev dependecies

`npm install`

install frontend dependencies

`bower install`

build app

`grunt` or `grunt build`

run

`npm start` and the app will be available in localhost:3000

run server and watch

`grunt server` everytime a file changes the project will rebuild and/or server will restart


### Other tasks

removes packages and builds (node_modules, bower_components, public/assets)

`grunt clean`

to run unit tests

`grunt test`

dependecy graphs (requires Graphviz installed)

`grunt angular-depends` for frontend
`npm run dep-graph` for backend (need npm package `madge`)


### Dependencies

How to install the python virtual environment

```sh
    cd ~/apps/arbimon2
    sudo apt install virtualenv
    sudo apt-get install python-dev
    sudo apt-get install pkg-config libpng-dev libfreetype6-dev
    sudo apt-get install libmysqlclient-dev
    virtualenv .env
    . .env/bin/activate
    pip install numpy
    pip install -r requirements.txt
    echo `realpath lib` > .env/lib/python2.7/site-packages/arbimon-server-libs.pth
```
