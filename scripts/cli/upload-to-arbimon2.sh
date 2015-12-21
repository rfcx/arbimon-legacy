#! /bin/sh
if [ "$ARBIMON_HOST" == "" ]; then
    echo "ARBIMON_HOST is empty. Please enter your project name:"
    read ARBIMON_HOST
fi

if [ "$ARBIMON_PROJECT" == "" ]; then
    echo "ARBIMON_PROJECT is empty. Please enter your project:"
    read ARBIMON_PROJECT
fi

if [ "$ARBIMON_SITE" == "" ]; then
    echo "ARBIMON_SITE is empty. Please enter the site id:"
    read ARBIMON_SITE
fi

if [ "$ARBIMON_NAME_FORMAT" == "" ]; then
    echo "ARBIMON_NAME_FORMAT is empty. Please enter the name format used:"
    read ARBIMON_NAME_FORMAT
fi

if [ "$ARBIMON_RECORDER" == "" ]; then
    echo "ARBIMON_RECORDER is empty. Please enter the recorder description:"
    read ARBIMON_RECORDER
fi

if [ "$ARBIMON_SOFTWARE_VERSION" == "" ]; then
    echo "ARBIMON_SOFTWARE_VERSION is empty. Please enter the software version used:"
    read ARBIMON_SOFTWARE_VERSION
fi

if [ "$ARBIMON_MIC" == "" ]; then
    echo "ARBIMON_MIC is empty. Please enter the microphone used:"
    read ARBIMON_MIC
fi

if [ "$ARBIMON_SESSION" == "" ]; then
    echo "ARBIMON_SESSION is empty. Please enter you arbimon session token:"
    read ARBIMON_SESSION
fi

file="$1"
hosturl="$ARBIMON_HOST"
project="$ARBIMON_PROJECT"   
site="$ARBIMON_SITE"         
format="$ARBIMON_NAME_FORMAT"
metadata="{\"recorder\":\"$ARBIMON_RECORDER\",\"sver\":\"$ARBIMON_SOFTWARE_VERSION\",\"mic\":\"$ARBIMON_MIC\"}"
session="arbimon2_session=$ARBIMON_SESSION"
url="$hosturl/uploads/audio?project=$project&site=$site&nameformat=$format"

curl "$url" -F "info=$metadata" -F "file=@$file" --cookie "$session"