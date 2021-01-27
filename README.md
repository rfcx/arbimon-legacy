# Arbimon - Acoustic Analyzer

[Release Notes](./RELEASE_NOTES.md) | [Deployment Notes](./DEPLOYMENT_NOTES.md)

## Getting started

### Local Dev Setup with Docker

The recommended dev setup is to use docker-compose to create your web and database containers. By default, docker-compose will create and seed a new database using the migrations and seeds in `scripts/db`.

1. Build the docker image

   ```sh
   docker build -t arbimon .
   ```

2. Run the containers (web and database)

   ```sh
   docker-compose up
   ```

   (To stop the server, press Ctrl-C.)

3. After the app container is running, open your browser at http://localhost:3000


### Alternative Local Dev Setup (no docker)
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
    npm run build
    ```

3. Add config Files
    - Clone `config/db.json` to `config/db.local.json` and fill it with required values
    - Clone `config/aws.json` to `config/aws.local.json` and fill it with required values
    - Clone `config/aws-rfcx.json` to `config/aws-rfcx.local.json` and fill it with required values
    - Clone `config/mandrill-key.json` to `config/mandrill-key.local.json` and fill it with required values
    - Clone `config/auth0.json` to `config/auth0.local.json` and fill it with required values
    - Clone `config/auth0-backend.json` to `config/auth0-backend.local.json` and fill it with required values
    - Clone `config/rfcx.json` to `config/rfcx.local.json` and fill it with required values

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
    npm run dev
    ```

6. Open app in browser at `http://localhost:3000` or at url which you can set in `hosts` file (check below).

### Debugging
- Can run in debug output mode
  - `sudo DEBUG=mysql-connection-manager,http,express:* node bin/www`
    - This will output all debug messages from the express framework as well as the mysql connections and http packages. Other node packages can be added, or subtracted from the list as needed.


## Deployment

### Kubernetes

The yaml configuration files are in `scripts/k8s`.

_TODO: How do services get deployed? How do we change configuration? How do we manually deploy to testing namespace?_


### Deployment to staging or production on AWS (sieve-analytics account)

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
    - `npm run build` to build css
5. Restart the web server/app
    - `pm2 restart 0 --time` to perform restart
    - `pm2 list` to check that the arbimon2 process is running

Additional steps for production (to support auto-scaling of the frontend)

6. In the EC2 console, create an image of the current `web` instance.
    - Name: arbimon-web-2020-09-09
    - No reboot: true

    ![production-deployment-1](https://user-images.githubusercontent.com/1175362/92625187-8c6a3700-f2f2-11ea-869e-bc39b7c502a6.png)

7. After the image is created, open "Auto scaling" -> "Launch configurations". Find the last launch configuration and make a copy ("Actions" -> "Copy launch configuration").

    ![production-deployment-2](https://user-images.githubusercontent.com/1175362/92625432-d3582c80-f2f2-11ea-97ca-09f235a74183.png)

8. Choose the AMI that was created in step 6 and create the launch configuration.
    - Name: arbimon-web-2020-09-09
    - AMI: arbimon-web-2020-09-09
    - (everything else the same)

9. Open "Auto scaling groups", and edit the `arbimon` group. Select the newly created launch configuration and then "Update".
    - Launch configuration: arbimon-web-2020-09-09

    ![production-deployment-3](https://user-images.githubusercontent.com/1175362/92625454-db17d100-f2f2-11ea-8089-8e85e9c999f9.png)

10. If there were more than 1 EC2 instances before deployment, terminate rest instances (but not the one that was used for image creation).
    ![production-deployment-4](https://user-images.githubusercontent.com/2122991/96923854-84d5aa80-14ba-11eb-996d-97cb6cb9a604.png)


## Practices

### Configuration

All configuration is stored in `config/` as json files. The files stored in git are a template or the defaults for the configuration. For local development, create `xyz.local.json` which will overide `xyz.json`.

Configuration can also be passed in as *environment variables* and will override the values specified in `xyz.local.json` and `xyz.json`. The format of each environment variable is `FILENAME_KEY` (filename + '_' + key + convert to uppercase).

Take the example `db.json`, which contains json keys for `host`, `database`, `password`:

```
{
    "host": "db.arb.rfcx.org",
    "user": "super",
    "password": "secret",
}
```

The equivalent environment variables are:
```
DB_HOST=db.arb.rfcx.org
DB_USER=super
DB_PASSWORD=secret
```


### Database migrations

Create an SQL file in `scripts/db` starting with an incremented number -- see `001-example-migrations.sql` for an example. Migrations may contain SQL statements to modify the data.

Periodically merge all the migrations into a single file `000-base-tables.sql`.

### Database seeds

The seed files in `scripts/db` are separated into reference data, species data and test data. The seed files must be kept up-to-date with any migrations that are added because they are always run after all the migrations (in docker-compose local environment).

### Python

Some parts of the Node.js app call Python. For this to work locally, you will need Python 2.7 and to (pip) install the dependencies from requirements.txt. The following script might be useful, or `scripts/setup/010-make_virtual_env.sh`. _TODO: complete the docs_

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
