#!/usr/bin/env python

import sys
import csv
from a2audio.recanalizer import Recanalizer
import cPickle as pickle
import tempfile
import boto
import os
import math
import time
import multiprocessing
from joblib import Parallel, delayed 
from contextlib import closing
import MySQLdb
from boto.s3.connection import S3Connection
from a2pyutils.config import Config
from a2pyutils.logger import Logger


start_time_all = time.time()
logWorkers = True
num_cores = int(math.floor(multiprocessing.cpu_count() /2))

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
db = None
try:
    db = MySQLdb.connect(host=config[0], user=config[1], passwd=config[2],db=config[3])
except MySQLdb.Error as e:
    log.write('fatal error cannot connect to database with credentials: '+config[0]+' '+config[1]+' '+config[2]+' '+config[3])
    quit()
log.write('database connection succesful')   
bucketName = config[4]
awsKeyId = config[5]
awsKeySecret = config[6]
log.write('tring connection to bucket') 

start_time = time.time()

conn = S3Connection(awsKeyId, awsKeySecret)
try:
    bucket = conn.get_bucket(bucket)
except Exception, ex:
    log.write('fatal error cannot connect to bucket '+ex.error_message)
    with closing(db.cursor()) as cursor:
        cursor.execute('update `jobs` set `remarks` = \'Error: connecting to bucket.\' where `job_id` = '+str(jId.strip(' ')))
        db.commit()
    quit()
log.write('connect to bucket  succesful') 
    
log.write('bucket config took:'+str(time.time()-start_time))   
  
tempFolder = tempFolders+"/classification_"+str(jobId)+"/"
modelLocal = tempFolder+'model.mod'
modelUri = sys.argv[2].strip("'").strip(" ");
log.write('fetching model from bucket ('+modelUri+') to ('+modelLocal+')')
start_time = time.time()

key = bucket.get_key(modelUri)     
key.get_contents_to_filename(modelLocal)
mod = None
if os.path.isfile(modelLocal):
    mod = pickle.load( open( modelLocal, "rb" ) )
    log.write('model was loaded to memory')
else:
    log.write('fatal error cannot load model')
    quit()
log.write('model retrieve took:'+str(time.time()-start_time))   
           
linesProcessed = 0
missedRecs = 0
#reads lines from stdin
log.write('start processing cycle. configuration took:'+str(time.time()-start_time_all))   
#for line in sys.stdin:
def processLine(line,bucket,mod,config,logWorkers):
    start_time_all = time.time()
    log = Logger(jobId , 'recClassify.py' , 'worker-thread',logWorkers)
    
    log.write('worker-thread started')
    
    try:
        db = MySQLdb.connect(host=config[0], user=config[1], passwd=config[2],db=config[3])
    except MySQLdb.Error as e:
        log.write('fatal error cannot connect to database with credentials: '+config[0]+' '+config[1]+' '+config[2]+' '+config[3])
        return 0
    #remove white space
    line = line.strip(' ')
    line = line.strip('\n')
    #split the line into variables
    recUri,modelUri,recId,jId,species,songtype = line.split(',')
    log.write('new subprocess:'+recUri)
    tempFolders = tempfile.gettempdir()
    tempFolder = tempFolders+"/classification_"+str(jId)+"/"

    #get rec from URI and compute feature vector using the spec vocalization
    start_time = time.time()
    log.write(str(type(bucket)))
    recAnalized = Recanalizer(recUri , mod[1] ,mod[2], mod[3] ,mod[4], tempFolder,log , bucket)
    log.write("recAnalized --- seconds ---" + str(time.time() - start_time))
    with closing(db.cursor()) as cursor:
        cursor.execute('update `jobs` set `progress` = `progress` + 1 where `job_id` = '+str(jId.strip(' ')))
        db.commit()  

    if recAnalized.status == 'Processed':
        log.write('rec processed')
        featvector = recAnalized.getVector()
        recName = recUri.split('/')
        recName = recName[len(recName)-1]
        vectorLocal = tempFolder+recName+'.vector'
        start_time = time.time()
        myfileWrite = open(vectorLocal, 'wb')
        wr = csv.writer(myfileWrite)
        wr.writerow(featvector)
        myfileWrite.close()
        log.write("wrote vector file --- seconds ---" + str(time.time() - start_time))
        if not os.path.isfile(vectorLocal):
            log.write('error writing: '+vectorLocal)
            with closing(db.cursor()) as cursor:
                cursor.execute('INSERT INTO `recordings_errors`(`recording_id`, `job_id`) VALUES ('+str(recId.strip(' '))+','+str(jId.strip(' '))+') ')
                db.commit()
            log.write("function exec --- seconds ---" + str(time.time() - start_time_all))
            return 0
        else:
            start_time = time.time()
            vectorUri = modelUri.replace('.mod','') + '/classification_'+ str(jId)+ '_' + recName + '.vector'
            log.write(str(type(bucket)))
            k = bucket.new_key(vectorUri )
            k.set_contents_from_filename(vectorLocal)
            k.set_acl('public-read')
            fets = recAnalized.features()
            clf = mod[0]
            noErrorFlag = True
            log.write("uploaded vector file --- seconds ---" + str(time.time() - start_time))
            start_time = time.time()
            try:
                res = clf.predict(fets)
            except:
                log.write('error predicting on recording: '+recUri)
                with closing(db.cursor()) as cursor:
                    cursor.execute('INSERT INTO `recordings_errors`(`recording_id`, `job_id`) VALUES ('+str(recId.strip(' '))+','+str(jId.strip(' '))+') ')
                    db.commit()
                noErrorFlag = False
            log.write("prediction --- seconds ---" + str(time.time() - start_time))
            if noErrorFlag:
                print recId,";",res[0],";",jId,";",species,";",songtype,";", min(featvector) ,";",max(featvector)
                sys.stdout.flush()
                log.write("function exec --- seconds ---" + str(time.time() - start_time_all))
                return 1
            else:
                log.write('error return 0')
                with closing(db.cursor()) as cursor:
                    cursor.execute('INSERT INTO `recordings_errors`(`recording_id`, `job_id`) VALUES ('+str(recId.strip(' '))+','+str(jId.strip(' '))+') ')
                    db.commit()
                log.write("function exec --- seconds ---" + str(time.time() - start_time_all))
                return 0
    else:
        log.write('error processing recording: '+recUri)
        log.write("function exec --- seconds ---" + str(time.time() - start_time_all))
        with closing(db.cursor()) as cursor:
            cursor.execute('INSERT INTO `recordings_errors`(`recording_id`, `job_id`) VALUES ('+str(recId.strip(' '))+','+str(jId.strip(' '))+') ')
            db.commit()
        return 0 
        
resultsParallel = Parallel(n_jobs=num_cores)(delayed(processLine)(line,bucket,mod,config,logWorkers) for line in sys.stdin)
log.write('this worker processed '+str(sum(resultsParallel))+' recordings')
log.write('end processing cycle')
log.close()
