# Arbimon II
Bio-Acoustic Analyzer

---
### Quick Setup:
 - install system dependencies
   ```
   curl -sL https://deb.nodesource.com/setup_0.10 | sudo bash -
   sudo apt-get install -y python-pip sox libsox-fmt-mp3 imagemagick nodejs libmysqlclient-dev python-dev libpng12-dev libfreetype6-dev python-virtualenv
   ```
   

 - install python dependencies, create python virtualenv and build
    ```
    npm run-script setup
    ```
    
 - run app (the app will be available in localhost:3000)
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
   
   

 - imagemagick - image manipulation tool (deprecated use node-lwip)
   ```
   sudo apt-get install imagemagick
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
   sudo apt-get install libpng12-dev libfreetype6-dev
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
