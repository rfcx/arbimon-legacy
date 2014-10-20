#!/usr/bin/env python

import sys
import numpy
import tempfile
import shutil
import os
from model import Model
from contextlib import closing
import MySQLdb
import json
import boto
import png

tempFolders = tempfile.gettempdir()
currDir = os.path.dirname(os.path.abspath(__file__))
config = [line.strip() for line in open(currDir+'/../config')]
bucketName = config[4]

db = MySQLdb.connect(host=config[0], user=config[1], passwd=config[2],db=config[3])
classes = {}
lowf=0
highf=0
cols = 0
jobId = -1
sampleRate = 0
for line in sys.stdin:
    line = line.strip(' ')
    line = line.strip('\n')
    meanfeat,difffeat,maxfeat,minfeat,stdfeat,medfeat,classid,present,spectrogram,columns ,low , high , jId ,sRate= line.split(';')
    lowf = low
    highf = high
    cols =columns
    jobId = int(jId)
    sampleRate = int(sRate)
    spectrogram  = spectrogram.strip(' ')
    spectrogram  = spectrogram.strip('\n')
    spectrogram  = spectrogram.split('*')
    spec = numpy.zeros(shape=(0,int(columns)))
    for s in spectrogram :
        row = s.split(',')
        row = map(float,row)
        spec = numpy.vstack((spec,row))
    
    if classid in classes:
        classes[classid].addSample(present,float(meanfeat),float(difffeat),float(maxfeat),float(minfeat),float(stdfeat),float(medfeat))
    else:
        classes[classid] = Model(classid,spec)
        classes[classid].addSample(present,float(meanfeat),float(difffeat),float(maxfeat),float(minfeat),float(stdfeat),float(medfeat))

modelFilesLocation = tempFolders+"/training_"+str(jobId)+"/"

with closing(db.cursor()) as cursor:

    cursor.execute("SELECT `project_id`,`user_id` FROM `jobs` WHERE `job_id` = "+str(jobId))
    db.commit()
    row = cursor.fetchone()
    project_id = row[0]	
    user_id = row[1] 	

    cursor.execute("SELECT * FROM `job_params_training` WHERE `job_id` = "+str(jobId))
    db.commit()
    row = cursor.fetchone()
    model_type_id = row[1]	
    training_set_id = row[2]
    useTrainingPresent = row[5]
    useTrainingNotPresent = row[6]
    useValidationPresent = row[7]
    useValidationNotPresent = row[8]

    cursor.execute("SELECT `params`,`validation_set_id` FROM `validation_set` WHERE `job_id` = "+str(jobId))
    db.commit()
    row = cursor.fetchone()
    
    cursor.execute('update `jobs` set `progress` = `progress` + 5 where `job_id` = '+str(jobId))
    db.commit()
    
    #j = json.loads(nameJson)
    decoded = json.loads(row[0])
    modelname = decoded['name']
    valiId = row[1]

for i in classes:
    if not classes[i].splitData(useTrainingPresent,useTrainingNotPresent,useValidationPresent,useValidationNotPresent):
        print 'not enough data for this class'
        continue
    
    classes[i].train()
    if useValidationPresent > 0:
        classes[i].validate()
    
    modFile = modelFilesLocation+"model_"+str(jobId)+"_"+str(i)+".mod"
    classes[i].save(modFile,lowf , highf,cols)
    
    modelStats = classes[i].modelStats()
    pngFilename = modelFilesLocation+'job_'+str(jobId)+'_'+str(i)+'.png'
    pngKey = 'project_'+str(project_id)+'/models/job_'+str(jobId)+'_'+str(i)+'.png'
    png.from_array(modelStats[4], 'L;8').save(pngFilename)
    
    #get Amazon S3 bucket
    conn = boto.connect_s3()
    bucket = conn.get_bucket(bucketName)
    modKey = 'project_'+str(project_id)+'/models/job_'+str(jobId)+'_'+str(i)+'.mod'
    #save model file to bucket
    k = bucket.new_key(modKey)
    k.set_contents_from_filename(modFile)
    #save vocalization surface png to bucket
    k = bucket.new_key(pngKey)
    k.set_contents_from_filename(pngFilename)
    k.set_acl('public-read')
    
    species,songtype = i.split("_")
    
    #save model to DB
    with closing(db.cursor()) as cursor:
        cursor.execute('update `jobs` set `progress` = `progress` + 5 where `job_id` = '+str(jobId))
        db.commit()        
        cursor.execute("SELECT   max(ts.`x2` -  ts.`x1`) , min(ts.`y1`) , max(ts.`y2`) "+
            "FROM `training_set_roi_set_data` ts "+
            "WHERE  ts.`training_set_id` =  "+str(training_set_id))
        db.commit()
        row = cursor.fetchone()
        lengthRoi = row[0]	
        minFrequ = row[1]
        maxFrequ = row[2]
        
        cursor.execute("SELECT   count(*) "+
            "FROM `training_set_roi_set_data` ts "+
            "WHERE  ts.`training_set_id` =  "+str(training_set_id))
        db.commit()
        row = cursor.fetchone()
        totalRois = row[0]
        
        statsJson = '{"roicount":'+str(totalRois)+' , "roilength":'+str(lengthRoi)+' , "roilowfreq":'+str(minFrequ)+' , "roihighfreq":'+str(maxFrequ)
        statsJson = statsJson + ',"accuracy":'+str(modelStats[0])+' ,"precision":'+str(modelStats[1])+',"recall":'+str(modelStats[2])
        statsJson = statsJson + ', "forestoobscore" :'+str(modelStats[3])+' , "roisamplerate" : '+str(sampleRate)+' , "roipng":"'+pngKey+'"}'
        
        cursor.execute("INSERT INTO `models`(`name`, `model_type_id`, `uri`, `date_created`, `project_id`, `user_id`,"+
                       " `training_set_id`, `validation_set_id`) " +
                       " VALUES ('"+modelname+"', "+str(model_type_id)+" , '"+modKey+"' , now() , "+str(project_id)+","+
                       str(user_id)+" ,"+str(training_set_id)+", "+str(valiId)+" )")
        db.commit()
        insertmodelId = cursor.lastrowid
        
        cursor.execute("INSERT INTO `model_stats`(`model_id`, `json_stats`) VALUES ("+str(insertmodelId)+",'"+statsJson+"')")
        db.commit()
        
        cursor.execute("INSERT INTO `model_classes`(`model_id`, `species_id`, `songtype_id`) VALUES ("+str(insertmodelId)
                       +","+str(species)+","+str(songtype)+")")
        db.commit()       
        
        cursor.execute('update `job_params_training` set `trained_model_id` = '+str(insertmodelId)+' where `job_id` = '+str(jobId))
        db.commit()
        
        cursor.execute('update `jobs` set `last_update` = now() where `job_id` = '+str(jobId))
        db.commit()
        cursor.execute('update `jobs` set `progress` = `progress_steps` ,  `completed` = 1  where `job_id` = '+str(jobId))
        db.commit()

#remore temporary directory
shutil.rmtree(tempFolders+"/training_"+str(jobId))
db.close()
print 'ended'