const fs = require('fs')
const AWS = require('aws-sdk');

const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_KEY,
    region: process.env.AWS_REGION_ID
})

async function uploadObjToFile (bucket, filename, buf, contentType) {
    return new Promise((resolve, reject) => {
        try {
            s3.putObject({
                Bucket: bucket,
                Key: filename,
                Body: buf,
                ContentType: contentType? contentType : 'text/csv'
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

async function getSignedUrl ({ Bucket, Key, Expires = 604800 }) {
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

async function uploadAsStream ({ filePath, Bucket, Key, ContentType }) {
  const Body = fs.createReadStream(filePath)
  return s3.upload({ Bucket, Key, ContentType, Body }).promise()
}

module.exports = {
  combineFilename,
  saveLatestData,
  getSignedUrl,
  uploadAsStream
}
