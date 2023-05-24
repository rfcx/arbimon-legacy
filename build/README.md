# Deployment

Overview:
- arbimon-recording-delete-job is built and deployed by Github Actions.
- Deployment is triggered by push to staging/master. All configuration is in the sub-folders `staging` and `production` (corresponding to a Kubernetes namespace).
- Secrets are stored on Kubernetes only in `arbimon-secrets` and `arbimon-cron-job-secrets` file of each namespace.
- Deployment notifications are posted on Slack #alerts-deployment


## Test deployment locally

Requires Docker.

1.  Build the image
    ```
    docker build -t arbimon -f build/Dockerfile .
    ```

2.  Run the app
    ```
    docker run -it -p 3000:3000 --env-file .env --rm arbimon
    ```


## Kubernetes configuration

Each sub-folder matches the name of a namespace in Kubernetes.
