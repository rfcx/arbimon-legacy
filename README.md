# Arbimon II
Bio-Acoustic Analyzer

---

### System dependencies:

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


 - image magick - image manipulation tool
   ```
   sudo apt-get install imagemagick
   ```
   
   
 - nodejs
   ```
   sudo add-apt-repository ppa:chris-lea/node.js
   sudo apt-get update
   sudo apt-get install nodejs
   ```
   
   
 - MySQL-python dependencies
   ```
   sudo apt-get install libmysqlclient-dev python-dev
   ```
   
   
 - scipy dependencies
   ```
   sudo apt-get install gfortran libopenblas-dev liblapack-dev
   ```
   
   
 - matplotlib dependencies
   ```
   sudo apt-get install libpng12-dev libfreetype6-dev
   ```
 
 - all dependencies  in one line
   ```
   sudo add-apt-repository ppa:chris-lea/node.js
   sudo apt-get update
   sudo apt-get install python-pip sox libsox-fmt-mp3 imagemagick nodejs libmysqlclient-dev python-dev gfortran libopenblas-dev liblapack-dev  libpng12-dev libfreetype6-dev
   ```  
   
 - node global dependencies(`sudo npm install -g <package>`):
  - bower
  - grunt-cli
  

 - install all python dependencies and create virtual enviroment
    ```
    sudo npm run-script setup    
    ```
 - or individual python dependencies (`sudo pip install`):
    - numpy 
    - scipy
    - MySQL-python 
    - scikit-learn 
    - boto 
    - pypng  
    - matplotlib
    - wsgiref
    - argparse
    - virtualenv
    - joblib
    - scikits.audiolab

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

`grunt server` everything a file changes the project will rebuild

clean packages and builds (node_modules, bower_components, public/assets)

`grunt clean` 
