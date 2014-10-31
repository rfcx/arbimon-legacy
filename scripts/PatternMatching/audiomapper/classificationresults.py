#!/usr/bin/env python

import sys
import shutil
import os
from contextlib import closing
import MySQLdb
import tempfile
from config import Config

currDir = os.path.dirname(os.path.abspath(__file__))
configuration = Config()
config = configuration.data()
db = MySQLdb.connect(host=config[0], user=config[1], passwd=config[2],db=config[3])
tempFolders = tempfile.gettempdir()
minVectorVal = 9999999.0
maxVectorVal = -9999999.0
print 'results'
jobId = 0
for line in sys.stdin:
    
    line = line.strip('\n')
    recId,presence,jId,species,songtype,minV,maxV = line.split(';')
    minV = minV.strip('\n')
    maxV = maxV.strip('\n')
    minV = float(minV.strip(' '))
    maxV = float(maxV.strip(' '))
    if minVectorVal > float(minV):
        minVectorVal = minV
    if maxVectorVal < float(maxV):
        maxVectorVal = maxV
    recId.strip(' ')
    presence.strip(' ')
    jId.strip(' ')
    jobId = jId
    species.strip(' ')
    songtype.strip(' ')
    with closing(db.cursor()) as cursor:
        cursor.execute("INSERT INTO `arbimon2`.`classification_results` "+
                       " (`job_id`, `recording_id`, `species_id`, `songtype_id`, `present`) "+
                       " VALUES ("+jId+","+recId+","+species+","+songtype+","+presence+");" )
        db.commit()
        cursor.execute('update `jobs` set `progress` = `progress_steps`, `completed` = 1  where `job_id` = '+str(jId))
        db.commit()

jsonStats = '{"minv": '+str(minVectorVal)+', "maxv" : '+str(maxVectorVal)+'}'
with closing(db.cursor()) as cursor:
    cursor.execute("INSERT INTO `arbimon2`.`classification_stats` "+
                   " (`job_id`, `json_stats`) "+
                   " VALUES ("+jobId+",'"+jsonStats+"');" )
    db.commit()    
print 'ended'
db.close()
shutil.rmtree(tempFolders+"/classification_"+str(jobId))

