#!/bin/bash

docker run -i --rm --network arbimon_default mariadb:10.4 mysql -hmysql -uadmin -padmin-secret arbimon2 < scripts/db/tables.sql
docker run -i --rm --network arbimon_default mariadb:10.4 mysql -hmysql -uadmin -padmin-secret arbimon2 < scripts/db/seeds.sql