import boto
from a2pyutils.config import Config
from soundscape.set_visual_scale_lib import get_bucket
import sys
import os

if len(sys.argv)<2:
    print "need a file list"
    exit(1)

if not os.path.exists(sys.argv[1]):
    print "need a valid file list"
    exit(1)    

print 'start'

configuration = Config()
config_dest = configuration.data()
config_source = list(config_dest)
config_source[4] = 'arbimon2'

source_bucket = get_bucket(config_source)
dest_bucket = get_bucket(config_dest)


with open(sys.argv[1]) as f:
    content = f.readlines()

localFileTemp = '/tmp/temp.flac'

for filename in content:
    filename = filename.strip("\n")
    print filename
    k = source_bucket.get_key(filename, validate=False)
    k.get_contents_to_filename(localFileTemp)
    del k
    k = dest_bucket.new_key(filename)
    k.set_contents_from_filename(localFileTemp)
    k.set_acl('public-read')
    del k
    os.remove(localFileTemp)

print 'done'