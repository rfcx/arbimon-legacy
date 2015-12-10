#! /bin/sh
if [ "$ARBIMON_HOST" == "" ]; then
    echo "ARBIMON_HOST is empty. Please enter your project name:"
    read ARBIMON_HOST
fi

if [ "$ARBIMON_PROJECT_NAME" == "" ]; then
    echo "ARBIMON_PROJECT_NAME is empty. Please enter your project name:"
    read ARBIMON_PROJECT_NAME
fi

if [ "$ARBIMON_SITE" == "" ]; then
    echo "ARBIMON_SITE is empty. Please enter the site id:"
    read ARBIMON_SITE
fi

file=`basename $1`
hosturl="$ARBIMON_HOST"
projectName="$ARBIMON_PROJECT_NAME"
site="$ARBIMON_SITE"
url="$hosturl/api/project/$projectName/recordings/exists/site/$site/file/$file"

response=`curl -s "$url"`

if echo "$response" | grep '\"exists\":true' > /dev/null; then
    # echo $1 already exists.
    exit 0
else
    # echo $1 does not exist.
    exit 1
fi