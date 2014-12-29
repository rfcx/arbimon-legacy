#!/usr/bin/env python

import sys
import numpy
from pylab import *
from a2audio.recanalizer import Recanalizer
bucket = 'arbimon2'
import tempfile
from contextlib import closing
import MySQLdb
import os
from a2pyutils.config import Config
from boto.s3.connection import S3Connection
import csv
import multiprocessing
from joblib import Parallel, delayed

tempFolders = tempfile.gettempdir()
currDir = os.path.dirname(os.path.abspath(__file__))
configuration = Config()
config = configuration.data()
num_cores = multiprocessing.cpu_count()

#reads lines from stdin
#for line in sys.stdin:

def processLine(line,config,tempFolders,currDir ):
    bucketName = config[4]
    awsKeyId = config[5]
    awsKeySecret = config[6]
    db = MySQLdb.connect(host=config[0], user=config[1], passwd=config[2],db=config[3])
    conn = S3Connection(awsKeyId, awsKeySecret)
    bucket = conn.get_bucket(bucketName)
    #remove white space
    line = line.strip(' ')
    
    #split the line into variables
    recUri,classs,present,low,high,columns,spectrogram,jId,sRate = line.split(';')
    spectrogram  = spectrogram.strip(' ')
    spectrogram  = spectrogram.strip('\n')   
    specCopy = spectrogram
    
    with closing(db.cursor()) as cursor:
        cursor.execute('update `jobs` set `state`="processing", `progress` = `progress` + 1 where `job_id` = '+str(jId))
        db.commit()
        
    #prepare the spec matrix from spectrogram string
    #the spec is the species vocalization 
    spectrogram  = spectrogram.strip(' ')
    spectrogram  = spectrogram.strip('\n')
    spectrogram  = spectrogram.split('*')
    spec = numpy.zeros(shape=(0,int(columns)))
    for s in spectrogram :
        row = s.split(',')
        row = map(float,row)
        spec = numpy.vstack((spec,row))
    #the spectrogram is now a matrix stored in spec
    jId = jId.strip('\n')
    tempFolder = tempFolders+"/training_"+str(jId)+"/"
    pid = -1
    with closing(db.cursor()) as cursor:
        cursor.execute('SELECT `project_id` FROM `jobs` WHERE `job_id` =  '+str(jId))
        db.commit()
        rowpid = cursor.fetchone()
        pid = rowpid[0]
        
    bucketBase = 'project_'+str(pid)+'/training_vectors/job_'+str(jId)+'/'
    
    #get rec from URI and compute feature vector using the spec vocalization
    recAnalized = Recanalizer(recUri.strip('\n') , spec ,low , high ,columns ,tempFolder,None, bucket)
    if recAnalized.status == 'Processed':
        recName = recUri.strip('\n').split('/')
        recName = recName[len(recName)-1]
        vectorUri = bucketBase+recName 
        fets = recAnalized.features()
        vector = recAnalized.getVector()
        vectorFile = tempFolder+recName
        myfileWrite = open(vectorFile, 'wb')
        wr = csv.writer(myfileWrite)
        wr.writerow(vector)
        myfileWrite.close()       
        k = bucket.new_key(vectorUri)
        k.set_contents_from_filename(vectorFile)
        k.set_acl('public-read')
        fets.append(classs)
        fets.append(present)
        fets.append(specCopy)
        fets.append(columns)
        fets.append(low)
        fets.append(high)
        fets.append(jId)
        fets.append(sRate.strip('\n'))
        fets.append(recUri)
        #print into stdout for next step (modelize.py)
        db.close()
        return ';'.join( str(x) for x in fets )
    else:
        db.close()
        return 'err'
    

resultsParallel = Parallel(n_jobs=num_cores)(delayed(processLine)(line,config,tempFolders,currDir) for line in sys.stdin)
for res in resultsParallel:
    if res != 'err':
        print res
        
