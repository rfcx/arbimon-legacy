#!/usr/bin/env python

#simple mapper
import sys

for line in sys.stdin:
    #line recUri,modelUri,recId
    line = line.strip()
    lineArgs = line.split(",")
    if len(lineArgs) < 2:
        continue
    print line
