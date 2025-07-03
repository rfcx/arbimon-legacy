const S3 = require('aws-sdk/clients/s3')
const fs = require('fs')
const config = require('../config')

const clients = {
  arbimon: new S3(getS3ClientConfig('aws')),
  rfcx: new S3(getS3ClientConfig('aws_rfcx'))
}

function getS3ClientConfig (type) {
  return {
      accessKeyId: config(type).accessKeyId,
      secretAccessKey: config(type).secretAccessKey,
      region: config(type).region
  }
}

function getClient (type) {
  if (!['arbimon', 'rfcx'].includes(type)) {
    throw new Error('S3 client type not supported')
  }
  return clients[type]
}

async function uploadAsStream ({ filePath, Bucket, Key, ContentType }, { clientType = 'arbimon' }) {
  const s3 = getClient(clientType)
  const Body = fs.createReadStream(filePath)
  return s3.upload({ Bucket, Key, ContentType, Body }).promise()
}

async function getSignedUrl ({ Bucket, Key, Expires = 604800 }, { clientType = 'arbimon' }) {
  const s3 = getClient(clientType)
  return new Promise((resolve, reject) => {
    s3.getSignedUrl('getObject', { Bucket, Key, Expires }, (err, data) => {
      if (err) {
        reject(err)
        return
      }
      resolve(data)
    })
  })
}

async function deleteObjects (keysArray, { clientType = 'arbimon' }) {
    const params = {
        Bucket: config('aws').bucketName,
        Delete: {
            Objects: keysArray
        }
    }
    const s3 = getClient(clientType);
    return s3.deleteObjects(params, function(err, data) {
        if (err && err.code != 'NoSuchKey') {
            console.error(err);
            return new Error(err);
        }
        console.info(data);
    });
}

module.exports = {
  uploadAsStream,
  getSignedUrl,
  deleteObjects
}
