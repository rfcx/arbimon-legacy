#!/bin/sh

usage="Usage: curl-upload -p [project id] -s [site id] -d [directory with recs to upload]"

while getopts ":d:(dir)p:(project-id)s:(site-id):" opt
do
     case $opt in
        d)   directory=$OPTARG;;
        p)   project_id=$OPTARG;;
        s)   site_id=$OPTARG;;
        \?)     echo $usage
                exit 2;;
    esac
done

if ( [ -z $directory ] || [ -z $project_id ] || [ -z $site_id ] )
then
    echo "Missing arguments!"
    echo $usage
    exit 2
fi

# host="http://localhost:3000"
host="https://arbimon.sieve-analytics.com"


if [ ! -f a2.cookie ]
then
    read -p "enter username:" user

    stty -echo
    printf "enter password for $user:"
    read pass
    printf "\n\r"
    stty echo
    
    curl -c a2.cookie -v -k --data "username=$user&password=$pass" "$host/login"
fi

info="info={\"format\":\"Arbimon\",\"site\":{\"id\":$site_id},\"recorder\":\"unknown\",\"mic\":\"unknown\",\"sver\":\"unknown\"}"
project="project={\"project_id\":$project_id}"

for f in `ls $directory`
do 
    path=`echo "$directory/$f" | sed 's/\/\//\//'`
    
    curl -k -b a2.cookie \
    -vvv -include --form "$project" --form "$info" --form "file=@$path" \
    "$host/uploads/audio/project/$project_id"
    
    echo "$f done"
done
