# Arbimon II
Bio-Acoustic Analyzer

---
### Quick Setup:
 - python 2.7 - comes with Ubuntu
 
 - All dependencies  in one line
   ```
   curl -sL https://deb.nodesource.com/setup_0.10 | sudo bash -
   sudo apt-get install -y python-pip sox libsox-fmt-mp3 imagemagick nodejs libmysqlclient-dev python-dev libpng12-dev libfreetype6-dev python-virtualenv
   ```
   
   
 - Install all python dependencies, create python virtual environment and build
    ```
    npm run-script setup
    ```
    
    
 - Run app (the app will be available in localhost:3000)
    ```
    npm start
    ```

### System dependencies:

 - nodejs
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
   
   
 - imagemagick - image manipulation tool
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

### Build

install backend and dev dependecies 

`npm install`

install frontend dependencies 

`bower install`

build app

`grunt` or `grunt build`

run

`npm start` and the app will be available in localhost:3000

run and watch

`grunt server` everytime a file changes the project will rebuild

remove packages and builds (node_modules, bower_components, public/assets)

`grunt clean` 

to run unit tests 

`grunt test`
