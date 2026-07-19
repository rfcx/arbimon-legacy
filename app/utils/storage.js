const fs = require('fs')
const config = require('../config')
// Shared endpoint-aware factory: routes the SDK through the in-cluster
// s3-proxy (s3-reader/s3-writer chain) when AWS_S3_ENDPOINT is set, else
// vanilla AWS. Centralized in @rfcx/s3-storage-client so every RFCx service
// constructs S3 clients the same way instead of duplicating endpoint wiring.
const { createS3Client: createSharedS3Client, getS3ClientConfig: sharedS3ClientConfig } = require('@rfcx/s3-storage-client')

// Map this app's config name ('aws' = legacy arbimon bucket, 'aws_rfcx' =
// rfcx streams bucket) to the shared factory's option shape, sourcing creds
// + region from the existing config() loader (which env-overrides keys).
function getS3ClientConfig (type) {
  return sharedS3ClientConfig({
    accessKeyId: config(type).accessKeyId,
    secretAccessKey: config(type).secretAccessKey,
    region: config(type).region
  })
}

// Canonical endpoint-aware S3 client factory for this app. ALL S3 access
// must build clients via this (or getClient/uploadAsStream/etc below).
// Constructing `new AWS.S3()` directly bypasses the storage chain and talks
// to AWS S3 directly -- do NOT do that.
function createS3Client (type) {
  return createSharedS3Client({
    accessKeyId: config(type).accessKeyId,
    secretAccessKey: config(type).secretAccessKey,
    region: config(type).region
  })
}

const clients = {
  arbimon: createS3Client('aws'),
  rfcx: createS3Client('aws_rfcx')
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
  deleteObjects,
  createS3Client,
  getS3ClientConfig
}
