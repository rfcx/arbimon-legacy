const S3 = require('aws-sdk/clients/s3')
const fs = require('fs')
const config = require('../config')

const clients = {
  arbimon: new S3(getS3ClientConfig('aws')),
  rfcx: new S3(getS3ClientConfig('aws_rfcx'))
}

// Honor AWS_S3_ENDPOINT / AWS_S3_FORCE_PATH_STYLE so deployments can
// route the SDK through an S3-compatible proxy/cache (e.g. the rfcx-local
// `s3.arbimon.org` endpoint, which fronts a B2-primary + AWS read-only
// chain for the arbimon2 and rfcx-streams-production buckets).
//
// When these env vars are unset, the SDK falls back to the default AWS
// S3 endpoint for the configured region — i.e. the pre-existing
// behavior. So this change is a no-op for any deployment that doesn't
// set the override.
function getS3ClientConfig (type) {
  const cfg = {
      accessKeyId: config(type).accessKeyId,
      secretAccessKey: config(type).secretAccessKey,
      region: config(type).region
  }
  const endpoint = process.env.AWS_S3_ENDPOINT
  if (endpoint && endpoint.trim()) {
    cfg.endpoint = endpoint.trim()
  }
  if (String(process.env.AWS_S3_FORCE_PATH_STYLE || '').toLowerCase() === 'true') {
    cfg.s3ForcePathStyle = true
  }
  return cfg
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
    });
}

module.exports = {
  uploadAsStream,
  getSignedUrl,
  deleteObjects
}
