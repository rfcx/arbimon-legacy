#!/bin/sh

if [ -z $1 ] || [ -z $2 ] 
then
    echo "\n usage backup-sh [bucket-name] [path/to/work]\n"
    exit 1
else
    bucketName=$1
    backupsPath=$2
fi
backupName=`date +'backup-%Y%m%d%k%m.sql'`

mysqldump -u db-backer arbimon2 > $backupsPath$backupName
if [ "$?" -ne 0 ]; then
    echo "error dumping the database"
    exit
fi

aws s3api put-object --bucket $bucketName --key db/$backupName --body $backupsPath$backupName
if [ "$?" -ne 0 ]; then
    echo "error uploading backup to s3bucket"
    exit
fi

rm $backupsPath$backupName
