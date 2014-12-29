#! /bin/sh
db=arbimon2

echo "Dumping $db structure"
mysqldump -p -d arbimon2 | sed 's/ AUTO_INCREMENT=[0-9][0-9]*//' > $db-structure.sql
echo "Dumping $db data"
mysqldump -p -t arbimon2 > $db-data.sql
