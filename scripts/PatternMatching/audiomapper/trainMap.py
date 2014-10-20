#!/usr/bin/env python

#simple mapper
#fowards to stdout lines recieved into stdin
#first step in training pipe (next: roigen.py)
import sys

for line in sys.stdin:
    #line has recId,speciesId,songtypeId,iniTime,endTime,lowFreq,highFreq,recuri,jobid
    line = line.strip()
    lineArgs = line.split(",")
    if len(lineArgs) < 2:
        continue
    print line
