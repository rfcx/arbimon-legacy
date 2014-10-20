#!/usr/bin/env python

import sys
from recanalizer import Recanalizer
bucket = 'arbimon2'
import cPickle as pickle
import tempfile
import boto
import os
from contextlib import closing
import MySQLdb

models = {}
bucket = 'arbimon2'
tempFolders = tempfile.gettempdir()
currDir = os.path.dirname(os.path.abspath(__file__))

config = [line.strip() for line in open(currDir+'/../config')]
db = MySQLdb.connect(host=config[0], user=config[1], passwd=config[2],db=config[3])

#reads lines from stdin
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
        conn = boto.connect_s3()
        bucket = conn.get_bucket(bucket)
        key = bucket.get_key(modelUri)     
        key.get_contents_to_filename(modelLocal)
        
        models[modelUri] = pickle.load( open( modelLocal, "rb" ) )
        mod = models[modelUri]
  
    with closing(db.cursor()) as cursor:
        cursor.execute('update `jobs` set `progress` = `progress` + 1 where `job_id` = '+str(jId.strip(' ')))
        db.commit()
        
    #get rec from URI and compute feature vector using the spec vocalization
    recAnalized = Recanalizer(recUri , mod[1] ,mod[2], mod[3] ,mod[4], tempFolder , bucket)
    fets = recAnalized.features()
    clf = mod[0]
    res = clf.predict(fets)
    print recId,";",res[0],";",jId,";",species,";",songtype


