#! .env/bin/python

import sys
import os
import multiprocessing
from joblib import Parallel, delayed
import MySQLdb
import MySQLdb.cursors
from a2pyutils import colors
from contextlib import closing
from a2pyutils.config import Config
from a2pyutils import tempfilecache
import a2pyutils.palette
from pylab import *
from boto.s3.connection import S3Connection
from contextlib import closing
import warnings
import numpy
import re
with warnings.catch_warnings():
    warnings.simplefilter("ignore")
    from scikits.audiolab import Sndfile, Format
import png
import time
start_time = time.time()

USAGE = """
{prog} recording_id  [palette_id]
    recording_id - id of the recording whose images tiles are needed
    palette_id - index of the gradient palette to use
                (defined in a2pyutils.palette)
""".format(
    prog=sys.argv[0]
)

def exit_error(msg, code=-1):
    print '<<<ERROR>>>\n{}\n<<<\ERROR>>>'.format(msg)
    sys.exit(code)

if len(sys.argv) < 2:
    print USAGE
    sys.exit()

recording_id = int(sys.argv[1])
palette_id = (
    (int(sys.argv[2]) if len(sys.argv) > 2 else 0) %
    len(a2pyutils.palette.palette))

configuration = Config()
config = configuration.data()
num_cores = multiprocessing.cpu_count()

try:
    db = MySQLdb.connect(
        host=config[0], user=config[1], passwd=config[2], db=config[3],
        cursorclass=MySQLdb.cursors.DictCursor
    )
except MySQLdb.Error as e:
    exit_error("cannot connect to database.")

bucketName = config[4]
awsKeyId = config[5]
awsKeySecret = config[6]

file_cache = tempfilecache.Cache(config=configuration)

with closing(db.cursor()) as cursor:
        cursor.execute(
            "SELECT uri FROM recordings WHERE recording_id = %s",
            [recording_id]
        )
        rec_data = cursor.fetchone()

if not rec_data:
    exit_error("Recording#{} not found".format(recording_id))
print("--- config %s seconds ---" % str(time.time() - start_time))
conn = S3Connection(awsKeyId, awsKeySecret)
try:
    bucket = conn.get_bucket(bucketName, validate=False)
except Exception, ex:
    exit_error('Could connect to bucket.')

rec_uri = rec_data['uri']
rec_file = file_cache.fetch(rec_uri)
if isinstance(rec_file, tempfilecache.CacheMiss):
    k = bucket.get_key(rec_uri, validate=False)
    k.get_contents_to_filename(rec_file.file)
    rec_file = rec_file.retry_get()
print("--- recing %s seconds ---" % str(time.time() - start_time))
rec_path = rec_file['path']
encoding = 0
channs = 0
samples = 0
sample_rate = 0
duration = 0.0
bit_rate = 0
file_format = ''
file_size  = os.stat(rec_path).st_size/1000
original = []
try:
    with closing(Sndfile(rec_path)) as f:
        encoding =  re.findall(r'\d+',f.encoding)
        read_encoding = 16
        if len(encoding) > 0:
            encoding = int(encoding[0])
            if encoding not in [8,16,32,64]:
                print encoding
                if encoding < 8:
                    read_encoding = 8
                elif encoding < 16:
                    read_encoding = 16
                elif encoding < 32:
                    read_encoding = 32
                else:
                    read_encoding = 64
            else:
                read_encoding = encoding
        else:
            encoding = 'unknown. read as int16'
        file_format = f.file_format
        channs = f.channels
        samples = f.nframes
        sample_rate = f.samplerate
        duration = float(samples)/float(sample_rate)
        bit_rate = f.samplerate * encoding * channs
        original = f.read_frames(f.nframes,dtype=numpy.dtype('int'+str(read_encoding)))
except:
    exit_error('Error reading recording.')
print("--- read rec %s seconds ---" % str(time.time() - start_time))
try:       
    Pxx, freqs, bins = mlab.specgram(original, NFFT=512, Fs=sample_rate , noverlap=256)
    Pxx[:,:] =  10. * numpy.log10( Pxx[:,:].clip(min=0.0000000001))
    smin = min([min((Pxx[j])) for j in range(Pxx.shape[0])])
    smax = max([max((Pxx[j])) for j in range(Pxx.shape[0])])
    spectrogramMatrix = numpy.flipud(255*(1-((Pxx - smin)/(smax-smin))))
except:
    exit_error('Error creating spectrogram.')
print("--- spectro %s seconds ---" % str(time.time() - start_time))
try:
    num_of_cols = Pxx.shape[1]
    num_of_tiles = 6
    cols_per_tile = int(floor(num_of_cols/num_of_tiles))
    last_tile_cols = num_of_cols- ( cols_per_tile * num_of_tiles)
    px2sec = duration / num_of_cols 
    max_freq = sample_rate / 2
    px2hz  = max_freq / Pxx.shape[0]
    spec_config = config[7]
    tile_max_w = spec_config['tiles']['max_width']
    tile_max_h = spec_config['tiles']['max_height']
    tile_count_x = int(numpy.ceil(num_of_cols  * 1.0 / tile_max_w))
    tile_count_y = int(numpy.ceil(Pxx.shape[0] * 1.0 / tile_max_h))
except:
    exit_error('Error calculating params.')
print("--- params %s seconds ---" % str(time.time() - start_time))
try:
    tiles_x=[]
    tiles_y=[]
    tile_set=[]
    
    for x in range(tile_count_x):
        tiles_x.append(x)
    for y in range(tile_count_y):
        tiles_y.append(y)
    
    total_y_tiles = len(tiles_y)
    total_x_tiles = len(tiles_x)
    
    for tile_y in tiles_y:
        tile_y0 = int(min( tile_y   *tile_max_h, Pxx.shape[0]))
        tile_y1 = int(min((tile_y+1)*tile_max_h, Pxx.shape[0]))
        tile_h  = tile_y1 - tile_y0
        for tile_x in tiles_x:
            tile_x0 = min( tile_x  *tile_max_w, num_of_cols)
            tile_x1 = min((tile_x+1)*tile_max_w, num_of_cols)
            tile_w  = tile_x1 - tile_x0
            tile_set.append({
                "j" : tile_x , "i" : tile_y ,
                "s"  : (tile_x0 * px2sec),  "hz" : (max_freq - tile_y0 * px2hz),
                "ds" : (tile_w * px2sec), "dhz" : (tile_h * px2hz),
                "x" : tile_x0, "y" : tile_y0,
                "x1" : tile_x1, "y1" : tile_y1,
                "w" : tile_w , "h" : tile_h
            })
except:
    exit_error('Error calculating tiles.')
print("--- calc tiles %s seconds ---" % str(time.time() - start_time))   
def saveTile(t,r_uri):
    ext = '.flac'
    if 'wav' in r_uri:
        ext = '.wav'    
    tile_key = r_uri.replace(ext, '.tile_'+str(t['j'])+'_'+str(t['i'])+'.png');
    tile_file = file_cache.fetch(tile_key)
    if isinstance(tile_file, tempfilecache.CacheMiss):
        png.from_array(spectrogramMatrix[t['y']:(t['y1']-1),t['x']:(t['x1']-1)], 'L;8').save(tile_file.file)

try:
    Parallel(n_jobs=num_cores)(
        delayed(saveTile)(tile ,rec_uri )
        for tile in tile_set)
except:
    exit_error('Error saving tiles.')
    
print("--- %s seconds ---" % str(time.time() - start_time))


"""
rec_path
channs
sample_rate
encoding 
samples 
duration
file_size
bit_rate
file_format


{ input_file: '/home/rafa/node/arbimon2/tmpfilecache/de5dca52c973594fde2c247e3383f6da06a3424cc690678f9ba0992d8878bb8a.flac',
  channels: 1,
  sample_rate: 8000,
  precision: 24,
  samples: 480000,
  duration: 60,
  file_size: '870k',
  bit_rate: '116k',
  sample_encoding: '24-bit FLAC',
  comment: '\'Comment=Processed by SoX\'' },
tiles: 
{ x: 11,
  y: 1,
  set: 
   [ [Object],
     [Object],
     [Object],
     [Object],
     [Object],
     [Object],
     [Object],
     [Object],
     [Object],
     [Object],
     [Object] ] } }
"""


