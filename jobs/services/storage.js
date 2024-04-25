const fs = require('fs')
const AWS = require('aws-sdk');

const export_s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_KEY,
    region: process.env.AWS_REGION_ID
})

const legacy_s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESSKEYID,
    secretAccessKey: process.env.AWS_SECRETACCESSKEY,
    region: process.env.AWS_REGION
})

const rfcx_s3 = new AWS.S3({
    accessKeyId: process.env.AWS_RFCX_ACCESSKEYID,
    secretAccessKey: process.env.AWS_RFCX_SECRETACCESSKEY,
    region: process.env.AWS_RFCX_REGION
})

async function uploadObjToFile (bucket, filename, buf, contentType) {
    return new Promise((resolve, reject) => {
        try {
            export_s3.putObject({
                Bucket: bucket,
                Key: filename,
                Body: buf,
                ContentType: contentType? contentType : 'text/csv',
                ACL: 'public-read'
            }, (putErr, data) => {
                if (putErr) {
                    console.error('putErr', putErr)
                    reject(putErr)
                }
                resolve()
            })
        } catch (err) {
            console.log(err)
            reject(new Error(err))
        }
    })
}

function combineFilename (timeStart, project, reportType, reportFormat) {
  return `${project}/${timeStart}/${reportType}${reportFormat}`
}

async function saveLatestData (bucket, buf, project, timeStart, reportType, reportFormat, contentType) {
  const filePath = combineFilename(timeStart, project, reportType, reportFormat)
  await uploadObjToFile(bucket, filePath, buf, contentType)
  return filePath
}

async function getSignedUrl ({ Bucket, Key, isLegacy = undefined, Expires = 604800 }) {
  return new Promise((resolve, reject) => {
    (isLegacy === undefined ? export_s3 : isLegacy === true ? legacy_s3 : rfcx_s3)
        .getSignedUrl('getObject', { Bucket, Key, Expires }, (err, data) => {
            if (err) {
                console.error('Error get signed url.', err)
                return reject(err)
            }
            resolve(data)
        })
  })
}

async function uploadAsStream ({ filePath, Bucket, Key, ContentType }) {
  const Body = fs.createReadStream(filePath)
  return export_s3.upload({ Bucket, Key, ContentType, Body }).promise()
}

async function getObject ({ Bucket, Key, isLegacy = true }) {
  return new Promise((resolve, reject) => {
    (isLegacy === true ? legacy_s3 : rfcx_s3)
      .getObject({
        Bucket: Bucket,
        Key: Key
      }, (err, data) => {
        if (err) {
          console.error('Error get s3 data.', err)
          return reject(err)
        }
        resolve(data.Body)
      })
  })
}

module.exports = {
  combineFilename,
  saveLatestData,
  getObject,
  getSignedUrl,
  uploadAsStream
}
