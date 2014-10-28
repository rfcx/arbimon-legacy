#!/usr/bin/env python
import time
import sys
import tempfile
import os
import csv
import subprocess
import boto
import shutil
import MySQLdb
from contextlib import closing
from audiomapper.config import Config
jobId = sys.argv[1].strip("'");
classificationName = sys.argv[2].strip("'");
allRecs = sys.argv[3].strip("'");
classifierId = sys.argv[5].strip("'");
projectId = sys.argv[6].strip("'");
userId = sys.argv[7].strip("'");

currDir = os.path.dirname(os.path.abspath(__file__))
configuration = Config()
config = configuration.data()
db = MySQLdb.connect(host=config[0], user=config[1], passwd=config[2],db=config[3])
bucketName = config[4]
sys.stdout.flush()

with closing(db.cursor()) as cursor:

    cursor.execute("SELECT m.`model_type_id`,m.`uri`,ts.`species_id`,ts.`songtype_id` FROM `models`m ,`training_sets_roi_set` ts WHERE m.`training_set_id` = ts.`training_set_id`  and `model_id` = "+str(classifierId))
    db.commit()
    numrows = int(cursor.rowcount)
    row = cursor.fetchone()
    model_type_id = row[0]
    model_uri = row[1]
    species = row[2]
    songtype = row[3]

tempFolders = tempfile.gettempdir()

#select the model_type by its id
if model_type_id == 1: #Pattern Matching (modified Alvarez thesis)
    
    #creating a temporary folder
    workingFolder = tempFolders+"/classification_"+str(jobId)
    if os.path.exists(workingFolder):
        shutil.rmtree(workingFolder)
    os.makedirs(workingFolder)
    
    sitesIds = ''
    if allRecs == '0':
        sitesIds = sys.argv[4].strip("'");
    else:
        ids = []
        with closing(db.cursor()) as cursor:
            cursor.execute("select `site_id` from `sites` where `project_id` = "+str(projectId))
            db.commit()
            numrows = int(cursor.rowcount)
            for i in range(0,numrows):
                row = cursor.fetchone()
                ids.append(str(row[0]))
        sitesIds = ','.join(ids)
        
    with closing(db.cursor()) as cursor:
        #create playlist
        
        cursor.execute("INSERT INTO `arbimon2`.`playlists` (`playlist_id`, `project_id`, `name`, `uri`)"+
                       " VALUES (NULL, '"+str(projectId)+"', '"+classificationName+" Classification Playlist', NULL);")
        db.commit()
        playlistId = cursor.lastrowid
        
        cursor.execute("UPDATE `arbimon2`.`job_params_classification` SET `playlist_id` = '"+str(playlistId)+"' WHERE `job_params_classification`.`job_id` = "+str(jobId)+";")
        db.commit()
        
        cursor.execute("SELECT `recording_id` , `uri` FROM `recordings` WHERE `site_id` in ("+sitesIds+")")
        db.commit()
        numrows = int(cursor.rowcount)
    
        classificationFileName = workingFolder+'/classification_'+str(jobId)+'.csv'
        #write training file to temporary folder
        recsIds = []
        progress_steps = 0
        with open(classificationFileName, 'wb') as csvfile:
            spamwriter = csv.writer(csvfile, delimiter=',')
            classificationRows = int(cursor.rowcount)
            progress_steps = classificationRows 
            for x in range(0,classificationRows):
                rowclassification = cursor.fetchone()
                recsIds.append(rowclassification[0])
                spamwriter.writerow([rowclassification[1],model_uri,rowclassification[0],jobId,species,songtype])
                
        progress_steps = progress_steps + 10
        cursor.execute('update `jobs` set `progress_steps` = '+str(progress_steps)+' where `job_id` = '+str(jobId))
        db.commit()     
        for i in recsIds:
            cursor.execute("INSERT INTO `arbimon2`.`playlist_recordings` (`playlist_id`, `recording_id`) VALUES ('"+str(playlistId) +"', '"+str(i)+"');")
            db.commit()       
                  
        
    #start the job
    #use the pipe (mapreduce like)
    print 'started pipe'
    sys.stdout.flush()
    p1 = subprocess.Popen(['/bin/cat' ,classificationFileName], stdout=subprocess.PIPE)
    p2 = subprocess.Popen(currDir+'/audiomapper/classifyMap.py', stdin=p1.stdout, stdout=subprocess.PIPE)
    p3 = subprocess.Popen(currDir+'/audiomapper/recClassify.py', stdin=p2.stdout, stdout=subprocess.PIPE)
    p4 = subprocess.Popen(currDir+'/audiomapper/classificationresults.py', stdin=p3.stdout, stdout=subprocess.PIPE)

    print p4.communicate( )[0].strip('\n')
    sys.stdout.flush()
    #update job progress
    
else:
    print("Unkown model type requested\n");

db.close()
