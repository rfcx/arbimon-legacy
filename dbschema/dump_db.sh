#! /bin/sh

if [ -n "$1" ]
then
    user=$1
else
    user=$USER
fi

db=arbimon2
prepop="job_types model_types permissions playlist_types project_news_types project_types roles role_permissions site_types soundscape_aggregation_types training_set_types user_account_support_type"
echo "Dumping $db structure"
mysqldump -u $user -p -d $db | sed 's/ AUTO_INCREMENT=[0-9][0-9]*//' > $db-structure.sql
echo "Dumping $db data"
mysqldump -u $user -p -t $db > $db-data.sql
echo "Dumping $db prepopulated tables"
mysqldump -u $user -p -t --skip-extended-insert --skip-add-locks $db $prepop > $db-prepop-data.sql
