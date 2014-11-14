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

tempFolders = tempfile.gettempdir()
currDir = os.path.dirname(os.path.abspath(__file__))

configuration = Config()
config = configuration.data()
db = MySQLdb.connect(host=config[0], user=config[1], passwd=config[2],db=config[3])

#reads lines from stdin
for line in sys.stdin:
    
    #remove white space
    line = line.strip(' ')
    
    #split the line into variables
    recUri,classs,present,low,high,columns,spectrogram,jId,sRate = line.split(';')
    spectrogram  = spectrogram.strip(' ')
    spectrogram  = spectrogram.strip('\n')   
    specCopy = spectrogram
    
    with closing(db.cursor()) as cursor:
        cursor.execute('update `jobs` set `progress` = `progress` + 1 where `job_id` = '+str(jId))
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
    
    #get rec from URI and compute feature vector using the spec vocalization
    recAnalized = Recanalizer(recUri.strip('\n') , spec ,low , high ,columns ,tempFolder, bucket)
    fets = recAnalized.features()
    fets.append(classs)
    fets.append(present)
    fets.append(specCopy)
    fets.append(columns)
    fets.append(low)
    fets.append(high)
    fets.append(jId)
    fets.append(sRate.strip('\n'))
    #print into stdout for next step (modelize.py)
    print ';'.join( str(x) for x in fets )


