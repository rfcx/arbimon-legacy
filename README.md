# Arbimon II
Bio-Acoustic Analyzer

---

### Local Development Setup
If you use Windows it's recommended to use WSL (Windows Subsystem for Linux) [https://docs.microsoft.com/en-us/windows/wsl/install-win10](https://docs.microsoft.com/en-us/windows/wsl/install-win10). Ubuntu 18.04 is recommended.


1. Clone Repo

    Clone this repository into a suitable location. If on linux or Mac this could be a directory in the home directory, on Windows with WSL it is often good to use `/mnt/c/Users/YourUserName/` as this is a shared folder between the Windows and WSL systems.

2. Install Dependencies

    App requires [https://nodejs.org/](node.js) to be installed (8.10.0 works, higher such as 12 will not. Unknown exactly where the cutoff is.) If you use `nvm` tool, you can run `nvm use` to switch node to required version (uses `.nvmrc` file).

    Install node modules:
    ```sh
    npm i
    ```

    App requires [https://bower.io/](bower) to be installed. To install using npm: `npm install bower --global`.

    Then install client-side dependencies:
    ```sh
    bower i
    ```
    Build client-side part:
    ```sh
    ./node_modules/gulp/bin/gulp.js build
    ```

3. Add config Files
    - Clone `config/db.json` to `config/db.local.json` and fill it with required values
    - Clone `config/aws.json` to `config/aws.local.json` and fill it with required values
    - Clone `config/aws-rfcx.json` to `config/aws-rfcx.local.json` and fill it with required values

    :exclamation: You must not change any original config file (like `db.json`, `aws.json` or `aws-rfcx.json`) to avoid commiting secrets to repository.

4. Setup SSH Tunnel to SQL Database

    Get ssh pem file (`arbimon2-bastion.pem`) from Admin or Team lead and put it into `~/.ssh` folder

    Change file permissions if needed:
    ```sh
    chmod 400 ~/.ssh/arbimon2-bastion.pem
    ```
    Run the following command in a separate terminal tab:
    ```sh
    ssh -N -L 3306:arbimon-dev-cluster.cluster-ctjyvabp9jnq.us-east-1.rds.amazonaws.com:3306 ec2-user@54.159.71.198 -i ~/.ssh/arbimon2-bastion.pem
    ```
    If you already have another database running at `3306` port, you will need to run the above command with a different local port like:
    ```sh
    ssh -N -L 3307:arbimon-dev-cluster.cluster-ctjyvabp9jnq.us-east-1.rds.amazonaws.com:3306 ec2-user@54.159.71.198 -i ~/.ssh/arbimon2-bastion.pem
    ```

    [optional] Check database connection with MySQL Workbench (or other DB administration tool)

5. Run Development Server
    ```sh
    ./node_modules/gulp/bin/gulp.js watch
    ```

6. Open app in browser at `http://localhost:3000` or at url which you can set in `hosts` file (check below).

### Debugging
- Can run in debug output mode
  - `sudo DEBUG=mysql-connection-manager,http,express:* node bin/www`
    - This will output all debug messages from the express framework as well as the mysql connections and http packages. Other node packages can be added, or subtracted from the list as needed.

### Information
- URLs
  - Production server [https://arbimon.sieve-analytics.com/](https://arbimon.sieve-analytics.com/)
  - Public Development server [https://arbimon-dev.sieve-analytics.com/](https://arbimon-dev.sieve-analytics.com/)
  - Local Development server [http://dev.arbimon.sieve-analytics.com/](http://dev.arbimon.sieve-analytics.com/) **Requires hosts file entry**
    - Update OS's `hosts` file with the following line:
      ```
      127.0.0.1 dev.arbimon.sieve-analytics.com
      ```
    - Set `APP_PORT` env var to `80` when you run the app:
      ```sh
      export APP_PORT=80; ./node_modules/gulp/bin/gulp.js watch
      ```
- Database Info
  - MySQL
  - Production has a db and the development enviroments share a secondary db.
- Servers and Networking
  - the production and dev servers are on a private network together and not directly reachable from the outside. There is a jump/tunnel server that can be used to get into these. Tunnel server adress: [54.159.71.198](54.159.71.198) with user `ec2user` and the private key file for authentication (obtain this from another member of the team).
    - This can be used to create a port forward to use with the database connection or can be directly connected to by ssh and then ssh to the other servers. Once on this server there are aliases setup to ssh to the other servers:
      - `ssh-web-dev` for development web server
      - `ssh-web` for production web server

### Deployment
1. SSH into the Bastion tunnel server
    - `ssh ec2-user@54.159.71.198 -i ~/.ssh/arbimon2-bastion.pem`
2. From inside the Bastion server, SSH into dev/prod server
    - `ssh-web-dev` for arbimon-dev.sieve-analytics.com
    - `ssh-web` for arbimon.sieve-analytics.com
    - Both these connections are defined in the `.bashrc` file and rely on the same `.ssh/arbimon2-app.pem` key.
3. Change to app directory
    - `cd apps/arbimon2`
4. Pull the latest changes from git
    - `git fetch -p` and `git pull`
4. Perform any dependency installs and rebuild the source code (same as local install)
    - `npm i` and `bower i`
    - `gulp build` to build css (in production use `./node_modules/.bin/gulp build`)
5. Restart the web server/app
    - `pm2 restart 0` to perform restart
    - `pm2 list` to check that the arbimon2 process is running

---
## Legacy README

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
### Git Workflow

1. Branch from dev
  - `
