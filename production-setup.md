
## production setup 
    
 1. install app system dependencies
   ```
   curl -sL https://deb.nodesource.com/setup_0.10 | sudo bash -
   sudo apt-get install -y python-pip sox libsox-fmt-mp3 imagemagick nodejs libmysqlclient-dev python-dev libpng12-dev libfreetype6-dev python-virtualenv
   ```


 2. add system user `arbimon2` to run app
    ```
    useradd -m -d /var/lib/arbimon2/ arbimon2
    ```


 3. install grunt and bower to build the app and forever to run it
    ```
    sudo npm install -g grunt-cli
    sudo npm install -g bower
    sudo npm install -g forever
    ```


 4. enter to app user
    ```
    sudo su - arbimon2
    ```
    
    
 5. download code and build app
    ```
    git clone -b production https://github.com/Sieve-Analytics/arbimon2.git app
    cd app
    npm run-script setup
    ```
    
    
 6. now the app is ready to deploy run with the following command
    ```
    NODE_ENV=production forever start bin/www
    ```
    
