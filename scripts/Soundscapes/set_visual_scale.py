#! .env/bin/python

import sys
import MySQLdb
import MySQLdb.cursors
from a2pyutils import colors
from contextlib import closing
from a2pyutils.config import Config
from a2pyutils import tempfilecache
import a2pyutils.palette
import soundscape.soundscape
from boto.s3.connection import S3Connection


USAGE = """
{prog} soundscape_id max_visual_scale
    soundscape_id - id of the soundscape whose image to edit
    max_visual_scale - clip range maximum (if '-', then it is
                       computed automatically)
""".format(
    prog=sys.argv[0]
)


def exit_error(msg, code=-1):
    print '<<<ERROR>>>\n{}\n<<<\ERROR>>>'.format(msg)
    sys.exit(code)


if len(sys.argv) < 3:
    print USAGE
    sys.exit()


soundscape_id = int(sys.argv[1])
clip_max = None if sys.argv[2] == '-' else int(sys.argv[2])

configuration = Config()
config = configuration.data()

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
            "SELECT uri FROM soundscapes WHERE soundscape_id = %s",
            [soundscape_id]
        )
        sc_data = cursor.fetchone()

if not sc_data:
    exit_error("Soundscape #{} not found".format(soundscape_id))

conn = S3Connection(awsKeyId, awsKeySecret)
try:
    bucket = conn.get_bucket(bucketName, validate=False)
except Exception, ex:
    exit_error('Could connect to bucket.')

img_uri = sc_data['uri']
scidx_uri = sc_data['uri'].replace('image.png', 'index.scidx')
print "Soundscape Index: {}".format(scidx_uri)
scidx_file = file_cache.fetch(scidx_uri)
if isinstance(scidx_file, tempfilecache.CacheMiss):
    print "Fetching {} from bucket".format(scidx_uri)
    k = bucket.get_key(scidx_uri, validate=False)
    k.get_contents_to_filename(scidx_file.file)
    scidx_file = scidx_file.retry_get()
    print scidx_file

img_file = file_cache.key2File(img_uri)

sc = soundscape.soundscape.Soundscape.read_from_index(scidx_file['path'])
if clip_max is not None:
    sc.stats['max_count'] = clip_max
palette_id = 1
sc.write_image(img_file, a2pyutils.palette.get_palette(palette_id))

k = bucket.new_key(img_uri)
k.set_contents_from_filename(img_file)
k.set_acl('public-read')

with closing(db.cursor()) as cursor:
    cursor.execute("""
        UPDATE `soundscapes`
        SET visual_max_value = %s, visual_palette = %s
        WHERE soundscape_id = %s
    """, [clip_max, palette_id, soundscape_id])
    db.commit()
