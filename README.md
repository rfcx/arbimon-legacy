# Arbimon II
Bio-Acoustic Analyzer

---

### System dependencies:
 - nodejs
  
   Ubuntu
   
   ```
   sudo add-apt-repository ppa:chris-lea/node.js
   sudo apt-get update
   sudo apt-get install nodejs
   sudo apt-get install sox
   sudo apt-get install libsox-fmt-mp3
   ```
   
   Mac OS X
   
   ```
   brew install nodejs
   ```
   
   or download binaries from [http://nodejs.org/](http://nodejs.org/)


node global dependencies:
 - bower - install with `sudo npm install -g bower`
 - grunt-cli - install with `sudo npm install -g grunt-cli`

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
