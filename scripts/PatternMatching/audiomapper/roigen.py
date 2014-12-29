#!/usr/bin/env python

#roi generator
#second step in training pipe (next: align.py)
#recieves recording info and roi info from stdin
#downloads recording from amazon bucket
#computes and extract the ROI
#prints to stdout roi info as well as roi spectrogram

import sys
from a2audio.roizer import Roizer
from pylab import *
import tempfile
import os
from contextlib import closing
import MySQLdb
from a2pyutils.config import Config
tempFolders = tempfile.gettempdir()
currDir = os.path.dirname(os.path.abspath(__file__))
import multiprocessing
from joblib import Parallel, delayed
num_cores = multiprocessing.cpu_count()

configuration = Config()
config = configuration.data()


jobId = -1
#for line in sys.stdin:
def processLine(line,config,tempFolders,currDir ):
    db = MySQLdb.connect(host=config[0], user=config[1], passwd=config[2],db=config[3])
    #line has recId,speciesId,songtypeId,iniTime,endTime,lowFreq,highFreq,recuri,jobid
    line = line.strip()
    line = line.strip('\n')
    lineArgs = line.split(",")
    if len(lineArgs) < 8:
        db.close()
        return 'err'
    recId = int(lineArgs[0])
    roispeciesId = int(lineArgs[1])
    roisongtypeId= int(lineArgs[2])
    initTime = float(lineArgs[3])
    endingTime = float(lineArgs[4])
    lowFreq = float(lineArgs[5])
    highFreq = float(lineArgs[6])
    recuri = lineArgs[7]
    jobId = int(lineArgs[8])
    tempFolder = tempFolders+"/training_"+str(jobId)+"/"
    roi = Roizer(recuri,tempFolder,config,initTime,endingTime,lowFreq,highFreq)
    
    with closing(db.cursor()) as cursor:
        cursor.execute('update `jobs` set `state`="processing", `progress` = `progress` + 1 where `job_id` = '+str(jobId))
        db.commit()
        
    if "NoAudio" in roi.status:
        with closing(db.cursor()) as cursor:
            cursor.execute('INSERT INTO `recordings_errors` (`recording_id`, `job_id`) VALUES ('+str(recId)+','+str(jobId)+') ')
            db.commit()
        db.close()
        return 'err'
    else:
        dims = roi.spec.shape
        rows = dims[0]
        columns = dims[1]
        ss = []
        for i in range(rows):
            row = roi.spec[i]
            ss.append ( ','.join( "%f" %(x) for x in row ))
            
        spectrogram =  '*'.join( str(x) for x in ss )
        a = '%s;%d;%d;%d;%d;%s;%d;%d;%d' %(str(roispeciesId)+"_"+str(roisongtypeId),(roi.samples),lowFreq,highFreq,roi.sample_rate,spectrogram,rows,columns,jobId)
        db.close()
        return a


resultsParallel = Parallel(n_jobs=num_cores)(delayed(processLine)(line,config,tempFolders,currDir) for line in sys.stdin)
for res in resultsParallel:
    if res != 'err':
        print res
