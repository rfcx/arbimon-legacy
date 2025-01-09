const { Upload } = require("@aws-sdk/lib-storage");
const { S3Client } = require("@aws-sdk/client-s3");
const AWS = require('aws-sdk');
const { createReadStream } = require("fs");
const fs = require('fs')

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

const multipart_upload_s3 = new S3Client({
    region: process.env.AWS_REGION_ID,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_KEY
    }
});

// Function to upload a file to S3 in chunks
async function uploadFileInChunks(filePath, bucketName, key) {
    const fileStream = createReadStream(filePath);
    const uploadParams = {
        Bucket: bucketName,
        Key: key,
        Body: fileStream
    };

    const parallelUploads3 = new Upload({
        client: multipart_upload_s3,
        params: uploadParams,
        queueSize: 4, // Number of concurrent uploads
        partSize: 5 * 1024 * 1024, // Each part size is 5MB
    });

    parallelUploads3.on('httpUploadProgress', (progress) => {
        console.log(`Progress: ${progress.loaded}/${progress.total}`);
    });

    try {
        const data = await parallelUploads3.done();
        console.log('Upload completed:', data);
    } catch (err) {
        console.error('Error uploading file:', err);
    }
}

const startTime = new Date();
let numPartsLeft

async function multipartUploadObjToFile (bucket, filename, buf, contentType) {
    console.log('\n\n<- multipartUploadObjToFile', bucket, filename, buf, contentType)
    return new Promise((resolve, reject) => {
        const multiPartParams = {
            Bucket: bucket,
            Key: filename,
            ContentType: contentType
        };
        // Upload
        let partNum = 0;
        const partSize = 1024 * 1024 * 20; // 20 Mb per part
        numPartsLeft = Math.ceil(buf.length / partSize);
        console.log('[multipartUploadObjToFile] numPartsLeft:', numPartsLeft, buf.length / partSize)
        try {
            export_s3.createMultipartUpload(multiPartParams, async function(mpErr, multipart){
                if (mpErr) { console.log('[multipartUploadObjToFile] error:', mpErr); return reject(mpErr) }
                let uploadId = multipart.UploadId
                console.log('[multipartUploadObjToFile] Got upload ID', uploadId);
                // Grab each partSize chunk and upload it as a part
                console.log('[multipartUploadObjToFile] before a loop parts', 0, buf.length, partSize, partNum, rangeStart < buf.length);
                for (var rangeStart = 0; rangeStart < buf.length; rangeStart += partSize) {
                    console.log('[multipartUploadObjToFile] inside a loop parts', buf.length, rangeStart < buf.length, partSize, partNum);
                    partNum++;
                    let end = Math.min(rangeStart + partSize, buf.length)
                    console.log('[multipartUploadObjToFile] end slice:', rangeStart, end, buf.slice(rangeStart, end));
                    let partParams = {
                        Body: buf.slice(rangeStart, end),
                        Bucket: bucket,
                        Key: filename,
                        PartNumber: String(partNum),
                        UploadId: uploadId
                    };
                    // Send a single part
                    console.log('Uploading part: #', partParams.PartNumber, ', Range start:', rangeStart);
                    await uploadPart(multipart, partParams);
                }
                console.log('[multipartUploadObjToFile] resolve all zip folder parts');
                resolve()
              });
        } catch (err) {
            console.log('[multipartUploadObjToFile] err:', err);
            reject(new Error(err))
        }
    })
}

let multipartMap = {
    Parts: []
};

async function uploadPart(multipart, partParams, tryNumInput) {
    return new Promise((resolve, reject) => {
        let tryNum = tryNumInput || 1;
        const maxUploadTries = 3;
        console.log('\n <- [uploadPart] partParams:', partParams)
        export_s3.uploadPart(partParams, async function(multiErr, mData) {
            console.log('\n <- [uploadPart] after', multiErr, mData)
            if (multiErr) {
                console.log('\n <- [uploadPart] multiErr, upload part error:', multiErr);
                // reject(multiErr)
                if (tryNum < maxUploadTries) {
                    console.log('\n <- [uploadPart] Retrying upload of part: #', partParams.PartNumber)
                    uploadPart(multipart, partParams, tryNum + 1);
                } else {
                    console.log('\n <- [uploadPart] Failed uploading part: #', partParams.PartNumber)
                }
                return;
            }
            multipartMap.Parts[Number(partParams.PartNumber) - 1] = {
                ETag: mData.ETag,
                PartNumber: Number(partParams.PartNumber)
            };
            console.log('Completed part', Number(partParams.PartNumber));
            console.log('\n <- [uploadPart] multipartMap.Parts', multipartMap.Parts);
            if (--numPartsLeft > 0) {
                console.log('complete only when all parts uploaded: numPartsLeft', numPartsLeft);
                return resolve();
            }
            let doneParams = {
                Bucket: partParams.Bucket,
                Key: partParams.Key,
                MultipartUpload: multipartMap,
                UploadId: multipart.UploadId
            };
            console.log('\n <- [uploadPart] Completing upload: multipartMap', multipartMap);
            console.log('\n <- [uploadPart] Completing upload: multipartMap.Parts', multipartMap.Parts);
            console.log('\n <- [uploadPart] Completing upload: doneParams', doneParams);
            await completeMultipartUpload(doneParams);
            resolve()
        });
    })
}

async function completeMultipartUpload(doneParams) {
    return new Promise((resolve, reject) => {
        export_s3.completeMultipartUpload(doneParams, function(err, data) {
            if (err) {
                console.error('\n <- completeMultipartUpload: An error occurred while completing the multipart upload', err);
                reject(err)
            } else {
                let delta = (new Date() - startTime) / 1000;
                console.log('\n <- completeMultipartUpload: Completed upload in', delta, 'seconds');
                console.log('\n <- completeMultipartUpload: Final upload data:', data);
                resolve()
            }
        });
    })
}

async function uploadObjToFile (bucket, filename, buf, contentType) {
    console.log('\n\n<- uploadObjToFile', bucket, filename, buf, contentType)
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
  console.log('buf', buf, buf.length)
  if (buf && (buf.length > 20971520)) {
    await multipartUploadObjToFile(bucket, filePath, buf, contentType)
    console.log('[multipartUploadObjToFile] after final')
  }
  else await uploadObjToFile(bucket, filePath, buf, contentType)
  return filePath
}

async function uploadFileToS3 (bucket, filePath, project, timeStart, reportType, reportFormat) {
    const key = `exports/${project}/${timeStart}/${reportType}${reportFormat}`
    await uploadFileInChunks(filePath, bucket, key)
    console.log('[uploadFileToS3] after final')
    return key
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

async function copyObject ({ Bucket, newPath, oldPath, isLegacy = true }) {
    return new Promise((resolve, reject) => {
      legacy_s3.copyObject({
          Bucket: Bucket,
          CopySource: encodeURI(`${Bucket}/${oldPath}`),
          Key: newPath
        }, (err, data) => {
          if (err) {
            console.error('Error copy s3 data.', err)
            return reject(err)
          }
          resolve(data.Body)
        })
    })
}

module.exports = {
  combineFilename,
  copyObject,
  saveLatestData,
  getObject,
  getSignedUrl,
  uploadFileToS3,
  uploadAsStream
}
