pipeline {
    agent {
        kubernetes {
            yaml """
kind: Pod
metadata:
  name: kaniko
spec:
  containers:
  - name: kaniko
    image: gcr.io/kaniko-project/executor:debug
    imagePullPolicy: Always
    command:
    - cat
    tty: true
    volumeMounts:
      - name: docker-config
        mountPath: /kaniko/.docker
  volumes:
    - name: docker-config
      configMap:
        name: docker-config
"""
        }
    }
    environment {
        APP = "arbimon"
        PHASE = branchToConfig(BRANCH_NAME)
        ECR = "887044485231.dkr.ecr.eu-west-1.amazonaws.com"
    }

    stages {

        stage("Build") {
            when {
                 expression { BRANCH_NAME ==~ /(develop|master)/ }
            }
            steps {
                slackSend (channel: "#${slackChannel}", color: '#FF9800', message: "*Arbimon Web*: Build started <${env.BUILD_URL}|#${env.BUILD_NUMBER}> commit ${env.GIT_COMMIT[0..6]} branch ${env.BRANCH_NAME}")
                catchError {
                container(name: 'kaniko') {
                sh '''
                /kaniko/executor --snapshotMode=redo --cache=true --build-arg PHASE=${PHASE} --build-arg --cache-repo=${ECR}/${APP}/cache --dockerfile `pwd`/Dockerfile --context `pwd` --destination=${ECR}/${APP}/${PHASE}:latest --destination=${ECR}/${APP}/${PHASE}:${GIT_COMMIT} --destination=${ECR}/${APP}/${PHASE}:v$BUILD_NUMBER
                '''
                }
                }
            }

           post {
               success {
                   slackSend (channel: "#${slackChannel}", color: '#3380C7', message: "*Arbimon Web*: Image built on <${env.BUILD_URL}|#${env.BUILD_NUMBER}> branch ${env.BRANCH_NAME}")
                   echo 'Compile Stage Successful'
               }
               failure {
                   slackSend (channel: "#${slackChannel}", color: '#F44336', message: "*Arbimon Web*: Image build failed <${env.BUILD_URL}|#${env.BUILD_NUMBER}> branch ${env.BRANCH_NAME}")
                   echo 'Compile Stage Failed'
                   sh "exit 1"
               }

           }
        }
        stage('Deploy') {
            agent {
                label 'slave'
            }
            when {
                 expression { BRANCH_NAME ==~ /(develop|master)/ }
            }
            steps {
                sh "kubectl -n ${PHASE} apply -k scripts/k8s/${PHASE}"
                sh "kubectl set image deployment ${APP} ${APP}=${ECR}/${APP}/${PHASE}:v$BUILD_NUMBER --namespace ${PHASE}"
            }

        }
        stage('Verifying') {
            agent {
                label 'slave'
            }
            options {
                skipDefaultCheckout true
            }
            when {
                 expression { BRANCH_NAME ==~ /(develop|master)/ }
            }
            steps {
            catchError {
            sh "kubectl rollout status deployment ${APP} --namespace ${PHASE}"
            slackSend (channel: "#${slackChannel}", color: '#4CAF50', message: "*Arbimon Web*: Deployment completed <${env.BUILD_URL}|#${env.BUILD_NUMBER}> branch ${env.BRANCH_NAME}")
            }
            }

        }
    }
}


def branchToConfig(branch) {
    script {
        result = "NULL"
        if (branch == 'develop') {
            result = "staging"
        slackChannel = "alerts-deployment"
        }
        echo "BRANCH:${branch} -> CONFIGURATION:${result}"
    }
    return result
}
