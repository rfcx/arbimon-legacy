#! .env/bin/python

import sys
import MySQLdb
import tempfile
import os
import time
import shutil
import math
import multiprocessing
import subprocess
import boto
from joblib import Parallel, delayed
from datetime import datetime
from contextlib import closing
from soundscape import soundscape
from a2pyutils.config import Config
from a2pyutils.logger import Logger
from a2audio.rec import Rec
from a2pyutils import palette
from boto.s3.connection import S3Connection

# to do
# job progrss in jobs table
#
#
#
##
# will change this to a external configuration file
num_cores = int(math.floor(multiprocessing.cpu_count() / (1.5)))

currDir = (os.path.dirname(os.path.realpath(__file__)))
USAGE = """
{prog} job_id
    job_id - job id in database
""".format(prog=sys.argv[0])


if len(sys.argv) < 2:
    print USAGE
    sys.exit(-1)

job_id = int(sys.argv[1].strip("'"))

tempFolders = tempfile.gettempdir()
workingFolder = tempFolders+"/soundscape_"+str(job_id)+"/"
if os.path.exists(workingFolder):
    shutil.rmtree(workingFolder)
os.makedirs(workingFolder)

log = Logger(job_id, 'playlist2soundscape.py', 'main')
log.write('script started')


configuration = Config()
config = configuration.data()
log.write('configuration loaded')
log.write('trying database connection')
try:
    db = MySQLdb.connect(
        host=config[0], user=config[1],
        passwd=config[2], db=config[3]
    )
except MySQLdb.Error as e:
    print "# fatal error cannot connect to database."
    log.write('fatal error cannot connect to database.')
    log.close()
    quit()
log.write('database connection succesful')


with closing(db.cursor()) as cursor:
    cursor.execute("""
    SELECT JP.playlist_id, JP.max_hertz, JP.bin_size,
        JP.soundscape_aggregation_type_id,
        SAT.identifier as aggregation, JP.threshold,
        J.project_id, J.user_id, JP.name, JP.frequency
    FROM jobs J
    JOIN job_params_soundscape JP ON J.job_id = JP.job_id
    JOIN soundscape_aggregation_types SAT ON
        SAT.soundscape_aggregation_type_id = JP.soundscape_aggregation_type_id
    WHERE J.job_id = {0}
    LIMIT 1
    """.format(job_id))

    job = cursor.fetchone()

if not job:
    print "Soundscape job #{0} not found".format(job_id)
    sys.exit(-1)


(
    playlist_id, max_hertz, bin_size, agrrid, agr_ident,
    threshold, pid, uid, name, frequency
) = job


aggregation = soundscape.aggregations.get(agr_ident)


if not aggregation:
    print "# Wrong agregation."
    print USAGE
    log.write('Wrong agregation')
    log.close()
    sys.exit(-1)

imgout = 'image.png'
scidxout = 'index.scidx'


if bin_size < 0:
    print "# Bin size must be a positive number. Input was: " + str(bin_size)
    print USAGE
    log.write('Bin size must be a positive number. Input was:' + str(bin_size))
    log.close()
    sys.exit(-1)

max_bins = int(max_hertz / bin_size)
log.write('max_bins '+str(max_bins))


bucketName = config[4]
awsKeyId = config[5]
awsKeySecret = config[6]
log.write('tring connection to bucket')

start_time = time.time()
bucket = ''
conn = S3Connection(awsKeyId, awsKeySecret)
try:
    bucket = conn.get_bucket(bucketName)
except Exception, ex:
    log.write('fatal error cannot connect to bucket '+ex.error_message)
    with closing(db.cursor()) as cursor:
        cursor.execute('update `jobs` set `state`="error", `completed` = -1, \
            `remarks` = \'Error: connecting to bucket.\' \
            where `job_id` = '+str(job_id))
        db.commit()
    quit()
log.write('connect to bucket  succesful')

q = (
    "SELECT r.`recording_id`,`uri`, DATE_FORMAT( `datetime` , \
    '%Y-%m-%d %H:%i:%s' ) as date FROM `playlist_recordings` pr , \
    `recordings` r " +
    "WHERE `playlist_id` = "+str(playlist_id) +
    " and pr.`recording_id` = r.`recording_id`"
)

totalRecs = 0
recsToProcess = []
with closing(db.cursor()) as cursor:
        cursor.execute(q)
        db.commit()
        numrows = int(cursor.rowcount)
        totalRecs = numrows
        for i in range(0, numrows):
            row = cursor.fetchone()
            recsToProcess.append({"uri": row[1], "id": row[0], "date": row[2]})

with closing(db.cursor()) as cursor:
    cursor.execute('update `jobs` set state="processing", `progress` = 1,\
        `progress_steps` = '+str(totalRecs+5)+' where `job_id` = '+str(job_id))
    db.commit()

if len(recsToProcess) < 1:
    print "# fatal error invalid playlist or no recordings on playlist."
    log.write('Invalid playlist or no recordings on playlist')
    with closing(db.cursor()) as cursor:
        cursor.execute('update `jobs` set `state`="error", \
            `completed` = -1,`remarks` = \'Error: Invalid playlist \
            (Maybe empty).\' where `job_id` = '+str(job_id))
        db.commit()
    log.close()
    sys.exit(-1)


scp = soundscape.Soundscape(aggregation, bin_size, max_bins)


def processRec(rec, config):
    id = rec['id']
    log.write(
        '------------------START WORKER THREAD LOG (id:'+str(id) +
        ')------------------'
    )
    try:
        db1 = MySQLdb.connect(
            host=config[0], user=config[1], passwd=config[2], db=config[3]
        )
    except MySQLdb.Error as e:
        log.write('worker id'+str(id)+' log: worker cannot connect to db')
        return None
    with closing(db1.cursor()) as cursor:
        cursor.execute('update `jobs` set `state`="processing", \
            `progress` = `progress` + 1 where `job_id` = '+str(job_id))
        db1.commit()
    results = []
    date = datetime.strptime(rec['date'], '%Y-%m-%d %H:%M:%S')

    uri = rec['uri']
    log.write('worker id'+str(id)+' log: rec uri:'+uri)
    start_time_rec = time.time()
    recobject = Rec(uri, workingFolder, config, config[4], log, False)
    log.write(
        'worker id' + str(id) + ' log: rec from uri' +
        str(time.time()-start_time_rec)
    )
    if recobject .status == 'HasAudioData':
        localFile = recobject.getLocalFileLocation()
        if localFile is None:
            log.write(
                '------------------END WORKER THREAD LOG (id:' + str(id) +
                ')------------------'
            )
            return None
        log.write(
            'worker id' + str(id) + ' log: cmd: /usr/bin/Rscript ' +
            currDir + '/fpeaks.R' + ' ' + localFile +
            ' ' + str(threshold) + ' ' + str(bin_size) + ' ' + str(frequency)
        )
        start_time_rec = time.time()
        proc = subprocess.Popen([
            '/usr/bin/Rscript', currDir+'/fpeaks.R',
            localFile,
            str(threshold),
            str(bin_size),
            str(frequency)
        ], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        stdout, stderr = proc.communicate()
        if stderr and 'LC_TIME' not in stderr:
            log.write(
                'worker id' + str(id) + ' log: fpeaks.R err:' +
                str(time.time()-start_time_rec) + " stdout: " + stdout +
                " stderr: "+stderr
            )
            os.remove(localFile)
            log.write('worker id' + str(id) + ' log:Error in recording:' + uri)
            with closing(db1.cursor()) as cursor:
                cursor.execute(
                    'INSERT INTO `recordings_errors`(`recording_id`,`job_id`) \
                    VALUES ('+str(id)+','+str(job_id)+') ')
                db1.commit()
            log.write(
                '------------------END WORKER THREAD LOG (id:' + str(id) +
                ')------------------')
            return None
        elif stdout:
            log.write(
                'worker id' + str(id) + ' log: fpeaks.R: ok' +
                str(time.time()-start_time_rec) + " stdout: " + stdout +
                " stderr: " + stderr
            )
            os.remove(localFile)
            if 'err' in stdout:
                return None
            freqs = stdout.strip(',')
            freqs = [float(i) for i in freqs.split(',')]
            results = {"date": date, "id": id, "freqs": freqs}
            log.write(
                '------------------END WORKER THREAD LOG (id:' + str(id) +
                ')------------------'
            )
            return results
    else:
        print 'invalid recording:' + uri
        log.write(
            'worker id' + str(id) + ' log: Invalid recording:' + uri)
        with closing(db1.cursor()) as cursor:
            cursor.execute('INSERT INTO `recordings_errors`(`recording_id`, \
                `job_id`) VALUES ('+str(id)+','+str(job_id)+') ')
            db1.commit()
        log.write(
            '------------------END WORKER THREAD LOG (id:' + str(id) +
            ')------------------'
        )
        return None

start_time_all = time.time()
resultsParallel = Parallel(n_jobs=num_cores)(
    delayed(processRec)(rec, config) for rec in recsToProcess
)
log.write("all recs parallel ---" + str(time.time() - start_time_all))
if len(resultsParallel) > 0:
    log.write('processing recordings results: '+str(len(resultsParallel)))
    with closing(db.cursor()) as cursor:
        cursor.execute('update `jobs` set `state`="processing", \
            `progress` = `progress` + 1 where `job_id` = '+str(job_id))
        db.commit()
    start_time_all = time.time()
    for result in resultsParallel:
        if result is not None:
            if len(result['freqs']) > 0:
                scp.insert_peaks(result['date'], result['freqs'], result['id'])
    log.write("inserting peaks:" + str(time.time() - start_time_all))
    start_time_all = time.time()
    scp.write_index(workingFolder+scidxout)
    log.write("writing index:" + str(time.time() - start_time_all))

    if aggregation['range'] == 'auto':
        statsMin = scp.stats['min_idx']
        statsMax = scp.stats['max_idx']
    else:
        statsMin = aggregation['range'][0]
        statsMax = aggregation['range'][1]

    query, query_data = ("""
        INSERT INTO `soundscapes`( `name`, `project_id`, `user_id`,
        `soundscape_aggregation_type_id`, `bin_size`, `uri`, `min_t`,
        `max_t`, `min_f`, `max_f`, `min_value`, `max_value`,
        `date_created`, `playlist_id`)
        VALUES (%s, %s, %s, %s, %s, NULL, %s, %s, 0, %s, 0, %s, NOW(), %s)
    """, [
        name, pid, uid, agrrid,
        bin_size, statsMin, statsMax,
        max_hertz, scp.stats['max_count'],
        playlist_id
    ])
    scpId = -1
    print query
    log.write(query)
    with closing(db.cursor()) as cursor:
        cursor.execute('update `jobs` set `state`="processing", \
            `progress` = `progress` + 1 where `job_id` = '+str(job_id))
        db.commit()
        cursor.execute(query, query_data)
        db.commit()
        scpId = cursor.lastrowid
    log.write('inserted soundscape into database')
    soundscapeId = scpId
    start_time_all = time.time()
    scp.write_image(workingFolder + imgout, palette.get_palette())
    with closing(db.cursor()) as cursor:
        cursor.execute('update `jobs` set `state`="processing", \
            `progress` = `progress` + 1 where `job_id` = '+str(job_id))
        db.commit()
    log.write("writing image:" + str(time.time() - start_time_all))
    uriBase = 'project_'+str(pid)+'/soundscapes/'+str(soundscapeId)
    imageUri = uriBase + '/image.png'
    indexUri = uriBase + '/index.scidx'
    k = bucket.new_key(imageUri)
    k.set_contents_from_filename(workingFolder+imgout)
    k.set_acl('public-read')
    with closing(db.cursor()) as cursor:
        cursor.execute('update `jobs` set `state`="processing", \
            `progress` = `progress` + 1 where `job_id` = '+str(job_id))
        db.commit()
    k = bucket.new_key(indexUri)
    k.set_contents_from_filename(workingFolder+scidxout)
    k.set_acl('public-read')
    with closing(db.cursor()) as cursor:
        cursor.execute("update `soundscapes` set `uri` = '"+imageUri+"' \
            where  `soundscape_id` = "+str(soundscapeId))
        db.commit()
else:
    print 'no results from playlist id:'+playlist_id
    with closing(db.cursor()) as cursor:
        cursor.execute('update `jobs` set `state`="error", \
            `completed` = -1,`remarks` = \'Error: No results found.\' \
            where `job_id` = '+str(job_id))
        db.commit()
    log.write('no results from playlist id:'+playlist_id)
    with closing(db.cursor()) as cursor:
        cursor.execute('update `jobs` set `state`="processing", \
            `progress` = `progress` + 4 where `job_id` = '+str(job_id))
        db.commit()


with closing(db.cursor()) as cursor:
    cursor.execute('update `jobs` set `state`="completed", `completed`=1, \
        `progress` = `progress` + 1 where `job_id` = '+str(job_id))
    db.commit()
log.write('closing database')

db.close()
log.write('removing temporary folder')

shutil.rmtree(tempFolders+"/soundscape_"+str(job_id))

log.write('ended script')
log.close()
