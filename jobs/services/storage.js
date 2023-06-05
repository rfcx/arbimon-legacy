const AWS = require('aws-sdk');
const s3 = new AWS.S3()

async function uploadObjToFile (bucket, filename, buf) {
    return new Promise((resolve, reject) => {
        try {
            s3.putObject({
                Bucket: bucket,
                Key: filename,
                Body: buf,
                ContentType: 'text/csv',
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

function combineFilename (timeStart, project, reportType) {
  return `${project}/${timeStart}/${reportType}.csv`
}

async function saveLatestData (bucket, buf, project, timeStart, reportType) {
  const filePath = combineFilename(timeStart, project, reportType)
  await uploadObjToFile(bucket, filePath, buf)
  return filePath
}

module.exports = {
  combineFilename,
  saveLatestData,
}
