#! /bin/sh
db=arbimon2

echo "Dumping $db structure"
mysqldump -p -d arbimon2 > $db-structure.sql
echo "Dumping $db data"
mysqldump -p -t arbimon2 > $db-data.sql