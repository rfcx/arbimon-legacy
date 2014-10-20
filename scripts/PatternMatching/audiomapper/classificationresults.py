#!/usr/bin/env python

import sys
import shutil
import os
from contextlib import closing
import MySQLdb
import tempfile


currDir = os.path.dirname(os.path.abspath(__file__))
config = [line.strip() for line in open(currDir+'/../config')]
db = MySQLdb.connect(host=config[0], user=config[1], passwd=config[2],db=config[3])
tempFolders = tempfile.gettempdir()

print 'results'
jobId = 0
for line in sys.stdin:
    
    line.strip('\n')
    recId,presence,jId,species,songtype = line.split(';')
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
        
print 'ended'
db.close()
shutil.rmtree(tempFolders+"/classification_"+str(jobId))

