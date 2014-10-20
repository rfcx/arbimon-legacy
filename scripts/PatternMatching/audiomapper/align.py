#!/usr/bin/env python

import sys
from roiset import Roiset
import numpy
import csv
import tempfile
tempFolders = tempfile.gettempdir()

classes = {}
validations = {}
classes_id = []
jId = -1
for line in sys.stdin:
    line = line.strip(' ')
    classid, numberOfSamples,lowFreq,highFreq,sample_rate,spectro,rows,columns,jobId = line.split(';')
    spectro  = spectro.strip(' ')
    spectro  = spectro.strip('\n')
    spectro  = spectro.split('*')
    rows = rows.strip(' ')
    rows = int(rows.strip('\n'))
    columns = columns.strip(' ')
    columns = int(columns.strip('\n'))
    jId = int(jobId.strip('\n'))

    spec = numpy.zeros(shape=(0,int(columns)))
    for s in spectro:
        row = s.split(',')
        row = map(float,row)
        spec = numpy.vstack((spec,row))

    if classid in classes:
        classes[classid].addRoi(float(lowFreq),float(highFreq),float(sample_rate),spec,rows,columns)
    else:
        classes[classid] = Roiset(classid,float(sample_rate) )
        classes[classid].addRoi(float(lowFreq),float(highFreq),float(sample_rate),spec,rows,columns)

for i in classes:
    classes[i].alignSamples()
    #classes[i].showMeanSurface()
    
validationsFilesLocation = tempFolders+"/training_"+str(jId)+"/"

#read validation file
validationFile = validationsFilesLocation+'validation_'+str(jId)+'.csv'

with open(validationFile, 'rb') as csvfile:
    validationreader = csv.reader(csvfile, delimiter=',')
    for row in validationreader:
        if len(row) < 2:
            continue
        recUri = row[0]
        classs = row[1]+'_'+row[2]
        present = row[3]
        meanSurface = classes[classs].meanSurface
        low = classes[classs].lowestFreq
        high = classes[classs].highestFreq
        columns = classes[classs].maxColumns

        rows = classes[classs].rows
        columns = classes[classs].maxColumns
        sRate = classes[classs].setSampleRate
        
        ss = []
        for i in range(rows):
            row = meanSurface[i]
            ss.append ( ','.join( "%f" %(x) for x in row ))
            
        spectrogram =  '*'.join( str(x) for x in ss )

        print "%s;%s;%s;%s;%s;%s;%s;%d;%d" %(recUri,classs,present,low,high,columns,spectrogram,jId,sRate)

