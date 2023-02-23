# arbimon-recording-delete-job
**Arbimon recordings delete job**

Arbimon background job to delete recordings from the recordings_deleted table older than 30 days.

## Initial Configuration

You need to specify credentials for Arbimon MySQL `.env.sample` to `.env` and filling it with your keys.

## Installing / Getting started

arbimon-recording-delete-job is running with Node.js v14.17.4
You can install or switch to this node version using the following commands:
```shell
nvm install
nvm use
```

Install dependencies:
```shell
npm install
```

Run script:
```
node index.js
```

Script will delete recordings and send a slack message to the arbimon-dev channel.

An example of terminal logs which you should see:
```shell
arbimon-recording-delete job started
2 Arbimon recordings were deleted
arbimon-recording-delete job finished
```


## Deploying / Publishing

Described in this [document](./build/README.md)
