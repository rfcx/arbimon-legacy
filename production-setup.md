
## production setup 

 1. install dependecies for production setup
    ```
    sudo apt-get install libcap2-bin git
    ```
    
 2. install app system dependencies
    ```
    sudo add-apt-repository ppa:chris-lea/node.js
    sudo apt-get update
    sudo apt-get install python-pip sox libsox-fmt-mp3 imagemagick nodejs libmysqlclient-dev python-dev gfortran libopenblas-dev liblapack-dev  libpng12-dev libfreetype6-dev libsndfile1 libsndfile-dev python-virtualenv r-base r-base-dev libfftw3-3 libfftw3-dev r-cran-rgl bwidget
    sudo scripts/setup/r-packages.R
    ```
 
 3. allow nodejs to use ports lower than 1024
    ```
    sudo setcap cap_net_bind_service=+ep /usr/bin/nodejs
    ```
    
 4. add system user **_arbimon2_** to run app
    ```
    useradd -m -d /var/lib/arbimon2/ arbimon2
    ```
    
 5. install grunt and bower to build the app and forever to run it
    ```
    sudo npm install -g grunt-cli
    sudo npm install -g bower
    sudo npm install -g forever
    ```
    
 6. enter to app user
    ```
    sudo su - arbimon2
    ```
    
 7. download code and build app
    ```
    git clone -b production https://github.com/Sieve-Analytics/arbimon2.git app
    cd app
    npm run-script setup
    ```
    
 8. now the app is ready to deploy run with the following command
    ```
    NODE_ENV=production SSL_KEY=ssl_key_path SSL_CERT=ssl_cert_path PORT=80 TLS_PORT=443 forever start bin/www
    ```
