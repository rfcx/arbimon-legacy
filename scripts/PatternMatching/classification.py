#!/usr/bin/env python

import time
import sys
import tempfile
import os
import csv
import subprocess
import boto
import time
import shutil
import MySQLdb
from contextlib import closing
from a2pyutils.config import Config
from a2pyutils.logger import Logger

start_time = time.time()

jobId = sys.argv[1].strip("'");
classificationName = sys.argv[2].strip("'");
allRecs = sys.argv[3].strip("'");
classifierId = sys.argv[5].strip("'");
projectId = sys.argv[6].strip("'");
userId = sys.argv[7].strip("'");
playlistId = sys.argv[8].strip("'");
print 'started'
log = Logger(jobId , 'classification.py' , 'main')
log.write('script started')

currDir = os.path.dirname(os.path.abspath(__file__))
currPython = sys.executable

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
    
bucketName = config[4]
sys.stdout.flush()


with closing(db.cursor()) as cursor:
    log.write('fetching model params...')
    cursor.execute("SELECT m.`model_type_id`,m.`uri`,ts.`species_id`,ts.`songtype_id` FROM `models`m ,`training_sets_roi_set` ts WHERE m.`training_set_id` = ts.`training_set_id`  and `model_id` = "+str(classifierId))
    db.commit()
    numrows = int(cursor.rowcount)
    if numrows  < 1:
        log.write('fatal error cannot fetch model params (classifier_id:'+str(classifierId)+')')
        quit()
    row = cursor.fetchone()
    model_type_id = row[0]
    model_uri = row[1]
    species = row[2]
    songtype = row[3]
    log.write('params fetched.')

log.write('using model uri: '+model_uri )
log.write('job species and songtype: '+str(species)+" "+str(songtype))

tempFolders = tempfile.gettempdir()

#select the model_type by its id
if model_type_id == 1: #Pattern Matching (modified Alvarez thesis)
    log.write('using Pattern Matching algorithm (model_type_id: '+str(model_type_id)+')' )

    #creating a temporary folder
    workingFolder = tempFolders+"/classification_"+str(jobId)
    if os.path.exists(workingFolder):
        log.write('removing directory: '+workingFolder)
        shutil.rmtree(workingFolder)
    os.makedirs(workingFolder)
    
    if os.path.exists(workingFolder):
        log.write('created directory: '+workingFolder)
    else:
        log.write('fatal error creating directory: '+workingFolder)
        quit()
        
    #log.write('use all recs:'+str(allRecs))
    #sitesIds = ''
    #if allRecs == '0':
    #    sitesIds = sys.argv[4].strip("'");
    #    log.write('individual sites selected')
    #else:
    #    log.write('all sites selected, fetching sites from database...')
    #    ids = []
    #    with closing(db.cursor()) as cursor:
    #        cursor.execute("select `site_id` from `sites` where `project_id` = "+str(projectId))
    #        db.commit()
    #        numrows = int(cursor.rowcount)
    #        if numrows  < 1:
    #            log.write('fatal error cannot sites (project_id:'+str(projectId)+')')
    #            quit()
    #        for i in range(0,numrows):
    #            row = cursor.fetchone()
    #            ids.append(str(row[0]))
    #    sitesIds = ','.join(ids)
    #    log.write('sites fetched.('+sitesIds+')')
    #
    log.write('fetching classification playlist')
    with closing(db.cursor()) as cursor:
        #create playlist
        #log.write('inserting playlist into database')
        #cursor.execute("INSERT INTO `arbimon2`.`playlists` (`playlist_id`, `project_id`, `name`, `uri`)"+
        #               " VALUES (NULL, '"+str(projectId)+"', '"+classificationName+" Classification Playlist', NULL);")
        #db.commit()
        #playlistId = cursor.lastrowid
        #log.write('playlist inserted with id:'+str(playlistId))
        #
        #log.write('update job_params_classification params...')
        #cursor.execute("UPDATE `arbimon2`.`job_params_classification` SET `playlist_id` = '"+str(playlistId)+"' WHERE `job_params_classification`.`job_id` = "+str(jobId)+";")
        #db.commit()
        #log.write('update job_params_classification updates')
        
        log.write('fetching recordings from selected playlist')
        cursor.execute("SELECT R.`recording_id` , R.`uri` FROM `recordings` R , `playlist_recordings` PR "+
                       " WHERE R.`recording_id` = PR.`recording_id` and PR.`playlist_id` = "+str(playlistId))
        db.commit()
        numrows = int(cursor.rowcount)
        log.write(str(numrows)+' fetched from database')
        
        classificationFileName = workingFolder+'/classification_'+str(jobId)+'.csv'
        #write training file to temporary folder
        log.write('creating training file:'+classificationFileName )
        recsIds = []
        progress_steps = 0
        with open(classificationFileName, 'wb') as csvfile:
            spamwriter = csv.writer(csvfile, delimiter=',')
            classificationRows = int(cursor.rowcount)
            progress_steps = classificationRows
            log.write('writing rows to file...')
            howMany = 0;
            for x in range(0,classificationRows):
                rowclassification = cursor.fetchone()
                recsIds.append(rowclassification[0])
                spamwriter.writerow([rowclassification[1],model_uri,rowclassification[0],jobId,species,songtype])
                howMany = howMany + 1
            log.write('wrote '+str(howMany)+' rows to file')
                
        progress_steps = progress_steps + 1
        log.write('updating total job steps in database')
        cursor.execute('update `jobs` set `progress_steps` = '+str(progress_steps)+' where `job_id` = '+str(jobId))
        db.commit()
        log.write('total job steps updated')
        
        #log.write('writing playlist recordings to database')
        #howManyInserted =0
        #for i in recsIds:
        #    cursor.execute("INSERT INTO `arbimon2`.`playlist_recordings` (`playlist_id`, `recording_id`) VALUES ('"+str(playlistId) +"', '"+str(i)+"');")
        #    db.commit()
        #    howManyInserted = howManyInserted +1
        #if howManyInserted == howMany:
        #    log.write('wrote '+str(howManyInserted )+' recordings to database')
        #else:
        #    log.write('fatal error: sfailed to write '+str(howMany-howManyInserted)+' recordings to databse')
        #    quit()
        #    
        i = 0
        with open(classificationFileName) as f:
            for i, l in enumerate(f):
                pass
            i = i + 1
            
        log.write(classificationFileName+' has '+str(i)+' lines')
        linesInCsvFile = i
        cursor.execute('SELECT count(*) FROM `playlist_recordings` WHERE `playlist_id` = '+str(playlistId))
        db.commit()
        row = cursor.fetchone()
        entriesInDb = row[0]
    
    log.write('playlist in database has '+str(entriesInDb)+' entries')
    
    if entriesInDb ==  linesInCsvFile :
        log.write('playlist and csvFile have the same number of recordings')
    else:
        log.write('fatal error playlist and csvFile DO NOT HAVE SAME NUMBER OF RECORDINGS ERROR!!!!!!!!!!!!!!!!!!!!!')
        quit()

    print 'started pipe'
    log.write('start classification pipe')
    sys.stdout.flush()
    log.write('starting cat of '+classificationFileName)
    p1 = subprocess.Popen(['/bin/cat' ,classificationFileName], stdout=subprocess.PIPE)
    log.write('calling audiomapper/classifyMap.py')
    p2 = subprocess.Popen([currPython , currDir+'/audiomapper/classifyMap.py',str(jobId),str(linesInCsvFile)], stdin=p1.stdout, stdout=subprocess.PIPE)
    log.write('calling audiomapper/recClassify.py')
    p3 = subprocess.Popen([currPython , currDir+'/audiomapper/recClassify.py',str(jobId),model_uri], stdin=p2.stdout, stdout=subprocess.PIPE)
    log.write('calling audiomapper/classificationresults.py')
    p4 = subprocess.Popen([currPython , currDir+'/audiomapper/classificationresults.py',str(jobId),str(linesInCsvFile)], stdin=p3.stdout, stdout=subprocess.PIPE)
    log.write('waiting for pipe to end')
    jOutput = p4.communicate( )[0].strip('\n')
    #log.write('job output: '+jOutput)
    #print jOutput
    sys.stdout.flush()
    #update job progress
    
else:
    print("Unkown model type requested\n");
    log.write('Unkown model type requested')

with closing(db.cursor()) as cursor:
    cursor.execute("UPDATE `jobs` SET `last_update`=now() WHERE `job_id` = "+str(jobId ))
    db.commit()
    
timestr = 'execution time: '+str(time.time() - start_time)
db.close()
log.write('script end')
log.write(timestr)
log.close()
print timestr
