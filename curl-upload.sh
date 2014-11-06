
project_id="26"
info="info={\"format\":\"Arbimon\",\"site\":{\"id\":78},\"recorder\":\"unknown\",\"mic\":\"unknown\",\"sver\":\"unknown\"}"

project="project={\"project_id\":$project_id}"

for f in `ls to-upload`
do 
    curl -k -b ~/.cookie \
        -v -include --form $project --form $info --form "file=@to-upload/$f" \
        https://arbimon.sieve-analytics.com/uploads/audio/project/$project_id
    echo "$f done"
done
