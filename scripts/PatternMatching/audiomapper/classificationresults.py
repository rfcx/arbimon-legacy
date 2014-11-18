#!/usr/bin/env python

import sys
import shutil
import os
from contextlib import closing
import MySQLdb
import tempfile
from a2pyutils.config import Config
from a2pyutils.logger import Logger

jobId = sys.argv[1].strip("'").strip(" ");
expectedRecordings = sys.argv[2].strip("'").strip(" ");

log = Logger(jobId , 'classificationresults.py' , 'reducer')
log.write('script started')

currDir = os.path.dirname(os.path.abspath(__file__))
configuration = Config()
config = configuration.data()
log.write('configuration loaded')
log.write('trying database connection')
try:
    db = MySQLdb.connect(host=config[0], user=config[1], passwd=config[2],db=config[3])
except MySQLdb.Error as e:
    log.write('fatal error cannot connect to database with credentials: '+config[0]+' '+config[1]+' '+config[2]+' '+config[3])
    quit()
log.write('database connection succesful')   

tempFolders = tempfile.gettempdir()
minVectorVal = 9999999.0
maxVectorVal = -9999999.0
print 'results'
log.write('start cycle to gather results (expected:'+str(expectedRecordings)+')')
processedCount=0
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
    species.strip(' ')
    songtype.strip(' ')
    with closing(db.cursor()) as cursor:
        cursor.execute("INSERT INTO `arbimon2`.`classification_results` "+
                       " (`job_id`, `recording_id`, `species_id`, `songtype_id`, `present`) "+
                       " VALUES ("+jId+","+recId+","+species+","+songtype+","+presence+");" )
        db.commit()
    processedCount = processedCount + 1
log.write('processed '+str(processedCount)+' of '+str(expectedRecordings))
log.write('end cycle to gather results')
log.write('saving stats to database')
jsonStats = '{"minv": '+str(minVectorVal)+', "maxv" : '+str(maxVectorVal)+'}'
with closing(db.cursor()) as cursor:
    cursor.execute("INSERT INTO `arbimon2`.`classification_stats` "+
                   " (`job_id`, `json_stats`) "+
                   " VALUES ("+jobId+",'"+jsonStats+"');" )
    db.commit()
    cursor.execute('update `jobs` set `progress` = `progress_steps` ,  `completed` = 1 , `last_update` = now() where `job_id` = '+str(jobId))
    db.commit()

db.close()
log.write('removing working folder')
shutil.rmtree(tempFolders+"/classification_"+str(jobId))
print 'ended'
log.close()