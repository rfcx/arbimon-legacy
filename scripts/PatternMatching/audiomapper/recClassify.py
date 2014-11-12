#!/usr/bin/env python

import sys
import csv
from recanalizer import Recanalizer
bucket = 'arbimon2'
import cPickle as pickle
import tempfile
import boto
import os
from contextlib import closing
import MySQLdb
from boto.s3.connection import S3Connection
from config import Config
from logger import Logger

jobId = sys.argv[1].strip("'").strip(" ");
log = Logger(jobId , 'recClassify.py' , 'worker')
log.write('script started')

models = {}
bucket = 'arbimon2'
tempFolders = tempfile.gettempdir()
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
bucketName = config[4]
awsKeyId = config[5]
awsKeySecret = config[6]
conn = S3Connection(awsKeyId, awsKeySecret)
try:
    bucket = conn.get_bucket(bucket)
except Exception, ex:
    log.write('fatal error cannot connect to bucket '+ex.error_message)
    quit()

linesProcessed = 0
missedRecs = 0
#reads lines from stdin
log.write('start processing cycle')   
for line in sys.stdin:
    
    #remove white space
    line = line.strip(' ')
    line = line.strip('\n')
    #split the line into variables
    recUri,modelUri,recId,jId,species,songtype = line.split(',')
    tempFolder = tempFolders+"/classification_"+str(jId)+"/"
    
    if modelUri in models:
        mod = models[modelUri]
    else:
        #get model from bucket
        modelLocal = tempFolder+'model.mod'
        log.write('fetching model from bucket ('+modelUri+') to ('+modelLocal+')')

        key = bucket.get_key(modelUri)     
        key.get_contents_to_filename(modelLocal)
        if os.path.isfile(modelLocal):
            models[modelUri] = pickle.load( open( modelLocal, "rb" ) )
            mod = models[modelUri]
            log.write('model was loaded to memory')
        else:
            log.write('fatal error cannot load model')
            quit()
        
    #get rec from URI and compute feature vector using the spec vocalization
    recAnalized = Recanalizer(recUri , mod[1] ,mod[2], mod[3] ,mod[4], tempFolder , bucket)
    
    if recAnalized.status == 'Processed':
        featvector = recAnalized.getVector()
        recName = recUri.split('/')
        recName = recName[len(recName)-1]
        vectorLocal = tempFolder+recName+'.vector'
        myfileWrite = open(vectorLocal, 'wb')
        wr = csv.writer(myfileWrite)
        wr.writerow(featvector)
        myfileWrite.close()
        if not os.path.isfile(vectorLocal):
            log.write('error writing: '+vectorLocal)
            missedRecs  = missedRecs  + 1
        else:   
            vectorUri = modelUri.replace('.mod','') + '/classification_'+ str(jId)+ '_' + recName + '.vector'
            k = bucket.new_key(vectorUri )
            k.set_contents_from_filename(vectorLocal)
            k.set_acl('public-read')
            fets = recAnalized.features()
            clf = mod[0]
            noErrorFlag = True
            try:
                res = clf.predict(fets)
            except:
                log.write('error predicting on recording: '+recUri)
                noErrorFlag = False
            
            if noErrorFlag:
                with closing(db.cursor()) as cursor:
                    cursor.execute('update `jobs` set `progress` = `progress` + 1 where `job_id` = '+str(jId.strip(' ')))
                    db.commit()
                    
                print recId,";",res[0],";",jId,";",species,";",songtype,";", min(featvector) ,";",max(featvector)
                linesProcessed = linesProcessed  + 1
            else:
                missedRecs  = missedRecs  + 1

    else:
        log.write('error processing recording: '+recUri)
        missedRecs = missedRecs + 1
        

log.write('this worker processed '+str(linesProcessed)+' recordings')
log.write('this worker missed '+str(missedRecs)+' recordings')
log.write('end processing cycle')
log.close()
