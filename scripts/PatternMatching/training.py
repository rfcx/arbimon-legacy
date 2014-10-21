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
from boto.s3.connection import S3Connection
from contextlib import closing
from config import Config
jobId = sys.argv[1];
modelName = sys.argv[2].strip("'");
currDir = os.path.dirname(os.path.abspath(__file__))
configuration = Config()
config = configuration.data()
db = MySQLdb.connect(host=config[0], user=config[1], passwd=config[2],db=config[3])
bucketName = config[4]
awsKeyId = config[5]
awsKeySecret = config[6]
print 'started'
sys.stdout.flush()
with closing(db.cursor()) as cursor:

    cursor.execute("SELECT `project_id`,`user_id` FROM `jobs` WHERE `job_id` = "+str(jobId))
    db.commit()
    numrows = int(cursor.rowcount)
    row = cursor.fetchone()
    project_id = row[0]	
    user_id = row[1] 	

    cursor.execute("SELECT * FROM `job_params_training` WHERE `job_id` = "+str(jobId))
    db.commit()
    numrows = int(cursor.rowcount)
    row = cursor.fetchone()
    model_type_id = row[1]	
    training_set_id = row[2]

tempFolders = tempfile.gettempdir()

#select the model_type by its id
if model_type_id == 1: #Pattern Matching (modified Alvarez thesis)
    progress_steps = 0
    #creating a temporary folder
    workingFolder = tempFolders+"/training_"+str(jobId)
    if os.path.exists(workingFolder):
        shutil.rmtree(workingFolder)
    os.makedirs(workingFolder)
    with closing(db.cursor()) as cursor:
        #create training file
        cursor.execute("SELECT r.`recording_id` , ts.`species_id` , ts.`songtype_id` , ts.`x1` , ts.`x2` , ts.`y1` , ts.`y2` , r.`uri` "+
                        "FROM `training_set_roi_set_data` ts, `recordings` r "+
                        "WHERE r.`recording_id` = ts.`recording_id` and ts.`training_set_id` = "+str(training_set_id))
        db.commit()
        trainingFileName = workingFolder+'/training_'+str(jobId)+'_'+str(training_set_id)+'.csv'
        #write training file to temporary folder
        with open(trainingFileName, 'wb') as csvfile:
            spamwriter = csv.writer(csvfile, delimiter=',')
            numTrainingRows = int(cursor.rowcount)
            progress_steps = numTrainingRows
            for x in range(0,numTrainingRows):
                rowTraining = cursor.fetchone()
                spamwriter.writerow([rowTraining[0], rowTraining[1],rowTraining[2],rowTraining[3],rowTraining[4],rowTraining[5],rowTraining[6],rowTraining[7],jobId])
    
        cursor.execute("SELECT DISTINCT (`recording_id`) FROM `training_set_roi_set_data` where `training_set_id` = "+str(training_set_id))
        db.commit()
        numrecordingsIds = int(cursor.rowcount)
        recordingsIds = []
        for x in range(0,numrecordingsIds):
            rowRec= cursor.fetchone()
            recordingsIds.append(rowRec[0])
            
        cursor.execute("SELECT DISTINCT (`species_id`), `songtype_id` FROM `training_set_roi_set_data` where `training_set_id` = "+str(training_set_id))
        db.commit()
        numSpeciesSongtype = int(cursor.rowcount)
     
        speciesSongtype = []
        for x in range(0,numSpeciesSongtype):
            rowSpecies = cursor.fetchone()
            speciesSongtype.append([rowSpecies[0],rowSpecies[1]])
    
    validationFile = workingFolder+'/validation_'+str(jobId)+'.csv'
    with open(validationFile, 'wb') as csvfile:
        spamwriter = csv.writer(csvfile, delimiter=',') 
        for x in range(0,numSpeciesSongtype):
            queryString = str(speciesSongtype[x][0])+" and `songtype_id` = "+str(speciesSongtype[x][1])
            with closing(db.cursor()) as cursor:
                cursor.execute("SELECT r.`uri` , `species_id` , `songtype_id` , `present` "+
                        "FROM `recording_validations` rv, `recordings` r " +
                        "WHERE r.`recording_id` = rv.`recording_id` and "+
                        "r.`recording_id` NOT IN ("+ ','.join([str(x) for x in recordingsIds]) +") " +
                        "and `species_id` = "+queryString)
                db.commit()
                numValidationRows = int(cursor.rowcount)
                progress_steps = progress_steps + numValidationRows
                for x in range(0,numValidationRows):
                    rowValidation = cursor.fetchone()
                    spamwriter.writerow([rowValidation[0], rowValidation[1],rowValidation[2],rowValidation[3]])
                    
    #get Amazon S3 bucket
    conn = S3Connection(awsKeyId, awsKeySecret)
    bucket = conn.get_bucket(bucketName)
    valiKey = 'project_'+str(project_id)+'/validations/job_'+jobId+'.csv'
    #save validation file to bucket
    k = bucket.new_key(valiKey)
    k.set_contents_from_filename(validationFile)
    #save validation to DB
    progress_steps = progress_steps + 15
    with closing(db.cursor()) as cursor:
        cursor.execute("INSERT INTO `validation_set` (`validation_set_id`, `project_id`, `user_id`, `name`, `uri`, `params`, `job_id`) " +
        "VALUES (NULL, '"+str(project_id)+"', '"+str(user_id)+"', '"+modelName+" validation', '"+valiKey+"', '{\"name\":\""+modelName+"\"}', '"+jobId+"');")
        db.commit()
        cursor.execute('update `job_params_training` set `validation_set_id` = '+str(cursor.lastrowid)+' where `job_id` = '+str(jobId))
        db.commit()
        cursor.execute('update `jobs` set `progress_steps` = '+str(progress_steps)+' where `job_id` = '+str(jobId))
        db.commit()
    #start the job
    #use the pipe (mapreduce like)
    print 'started pipe'
    sys.stdout.flush()
    p1 = subprocess.Popen(['/bin/cat' ,trainingFileName], stdout=subprocess.PIPE)
    p2 = subprocess.Popen(currDir+'/audiomapper/trainMap.py', stdin=p1.stdout, stdout=subprocess.PIPE)
    p3 = subprocess.Popen(currDir+'/audiomapper/roigen.py', stdin=p2.stdout, stdout=subprocess.PIPE)
    p4 = subprocess.Popen(currDir+'/audiomapper/align.py', stdin=p3.stdout, stdout=subprocess.PIPE)
    p5 = subprocess.Popen(currDir+'/audiomapper/recnilize.py', stdin=p4.stdout, stdout=subprocess.PIPE)
    p6 = subprocess.Popen(currDir+'/audiomapper/modelize.py', stdin=p5.stdout, stdout=subprocess.PIPE)
   
    print p6.communicate( )[0].strip('\n')
    sys.stdout.flush()
    #update job progress

else:
    print("Unkown model type requested\n");

db.close()