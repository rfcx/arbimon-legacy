#!/usr/bin/env python

#simple mapper
import sys
from logger import Logger

jobId = sys.argv[1].strip("'").strip(" ");
linesExpected = sys.argv[2].strip("'").strip(" ");
linesProcessed = 0
log = Logger(jobId , 'classifyMap.py' , 'mapper')
log.write('script started')
log.write('process '+str(linesExpected)+' expected recordings:')
for line in sys.stdin:
    #line recUri,modelUri,recId
    line = line.strip()
    lineArgs = line.split(",")
    if len(lineArgs) < 2:
        continue
    print line
    linesProcessed  = linesProcessed  + 1
    
log.write('processed: '+str(linesProcessed )+"/"+str(linesExpected)+" ")
log.write('script end')
log.close()
