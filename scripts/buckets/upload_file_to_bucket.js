var fs    = require('fs');
var AWS   = require('aws-sdk');
var config = require('../../config');


if(process.argv.length < 4){
    console.log(
        "Script for uploading a file to the bucket.\n" +
        "usage : \n" +
        "  %s filepath key [public] \n" +
        "arguments : \n" + 
        "    filepath : the file to upload\n" +
        "    key      : the key in the bucket\n" +
        "    public   : whether to upload it as a public read file or not (if ommited, then it is private).\n",
        process.argv[0] + " " + process.argv[1]
    );
    process.exit();
}

var bucketName = config('aws').bucketName;
var filepath = process.argv[2];
var key      = process.argv[3];
var public_read = process.argv.length >= 5 && /public/.test(process.argv[4]);
AWS.config.update({
    accessKeyId: config('aws').accessKeyId, 
    secretAccessKey: config('aws').secretAccessKey,
    region: config('aws').region
});
var s3 = new AWS.S3();


console.log(
    'Uploading...\n' +
    ' file   : ' + filepath + '\n' +
    ' bucket : ' + bucketName + '\n' +
    ' key    : ' + key + '\n' +
    ' acl    : ' + (public_read?'public':'private') + '\n'
);


var params = { 
    Bucket: bucketName, 
    Key: key,
    Body: fs.createReadStream(filepath)
};

if(public_read){
    params.ACL = 'public-read';
}

s3.putObject(params, function(err, data){
    if(err){
        console.error(err);
        process.exit(-1);
    } else {
        console.log("File uploaded successfully.");
        console.log(data);
        process.exit(0);
    }
});
