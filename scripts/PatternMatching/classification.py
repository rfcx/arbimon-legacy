#! .env/bin/python

import time
import sys
import tempfile
import os
import csv
import subprocess
import boto
import time
import shutil
import MySQLdb
from contextlib import closing
from a2pyutils.config import Config
from a2pyutils.logger import Logger


USAGE = """Runs a classification job.
{prog} job_id
    job_id - job id in database
""".format(prog=sys.argv[0])


if len(sys.argv) < 2:
    print USAGE
    sys.exit(-1)

start_time = time.time()

jobId = int(sys.argv[1].strip("'"))

log = Logger(jobId, 'classification.py', 'main')
log.also_print = True

print 'started'
log.write('script started')

currDir = os.path.dirname(os.path.abspath(__file__))
currPython = sys.executable

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
    sys.exit(-1)
log.write('database connection succesful')


with closing(db.cursor()) as cursor:
    cursor.execute("""
        SELECT J.`project_id`, J.`user_id`,
            JP.model_id, JP.playlist_id,
            JP.name
        FROM `jobs` J
        JOIN `job_params_classification` JP ON JP.job_id = J.job_id
        WHERE J.`job_id` = %s
    """, [jobId])
    row = cursor.fetchone()

if not row:
    print "Could not find training job #{}".format(jobId)
    sys.exit(-1)


(
    projectId, userId,
    classifierId, playlistId,
    classificationName
) = row
print row

bucketName = config[4]
sys.stdout.flush()


with closing(db.cursor()) as cursor:
    log.write('fetching model params...')
    cursor.execute("""
        SELECT m.`model_type_id`,m.`uri`,ts.`species_id`,ts.`songtype_id`
        FROM `models`m ,`training_sets_roi_set` ts
        WHERE m.`training_set_id` = ts.`training_set_id`
          AND `model_id` = %s
    """, [classifierId])
    db.commit()
    numrows = int(cursor.rowcount)
    if numrows < 1:
        log.write(
            'fatal error cannot fetch model params (classifier_id:' +
            str(classifierId) + ')')
        quit()
    row = cursor.fetchone()
    model_type_id = row[0]
    model_uri = row[1]
    species = row[2]
    songtype = row[3]
    log.write('params fetched.')

log.write('using model uri: '+model_uri)
log.write('job species and songtype: '+str(species)+" "+str(songtype))

tempFolders = tempfile.gettempdir()

# select the model_type by its id
if model_type_id == 1:  # Pattern Matching (modified Alvarez thesis)
    log.write(
        'using Pattern Matching algorithm (model_type_id: ' +
        str(model_type_id)+')')

    # creating a temporary folder
    workingFolder = tempFolders+"/classification_"+str(jobId)
    if os.path.exists(workingFolder):
        log.write('removing directory: '+workingFolder)
        shutil.rmtree(workingFolder)
    os.makedirs(workingFolder)

    if os.path.exists(workingFolder):
        log.write('created directory: '+workingFolder)
    else:
        log.write('fatal error creating directory: '+workingFolder)
        quit()

    log.write('fetching classification playlist')
    with closing(db.cursor()) as cursor:
        log.write('fetching recordings from selected playlist')
        cursor.execute("""
            SELECT R.`recording_id`, R.`uri`
            FROM `recordings` R, `playlist_recordings` PR
            WHERE R.`recording_id` = PR.`recording_id`
              AND PR.`playlist_id` = %s
        """, [playlistId])
        db.commit()
        numrows = int(cursor.rowcount)
        log.write(str(numrows)+' fetched from database')

        classificationFileName = '{}/classification_{}.csv'.format(
            workingFolder, jobId
        )

        # write training file to temporary folder
        log.write('creating training file:'+classificationFileName)
        recsIds = []
        progress_steps = 0
        with open(classificationFileName, 'wb') as csvfile:
            spamwriter = csv.writer(csvfile, delimiter=',')
            classificationRows = int(cursor.rowcount)
            progress_steps = classificationRows
            log.write('writing rows to file...')
            howMany = 0
            for x in range(0, classificationRows):
                rowclassification = cursor.fetchone()
                recsIds.append(rowclassification[0])
                spamwriter.writerow([
                    rowclassification[1], model_uri,
                    rowclassification[0], jobId, species, songtype])
                howMany = howMany + 1
            log.write('wrote '+str(howMany)+' rows to file')

        progress_steps = progress_steps + 1
        log.write('updating total job steps in database')
        cursor.execute("""
            UPDATE `jobs`
            SET `progress_steps`=%s, progress=0, state="processing"
            WHERE `job_id` = %s
        """, [progress_steps, jobId])
        db.commit()
        log.write('total job steps updated')

        i = 0
        with open(classificationFileName) as f:
            for i, l in enumerate(f):
                pass
            i = i + 1

        log.write(classificationFileName+' has '+str(i)+' lines')
        linesInCsvFile = i
        cursor.execute("""
            SELECT count(*)
            FROM `playlist_recordings`
            WHERE `playlist_id` = %s
        """, [playlistId])
        db.commit()
        row = cursor.fetchone()
        entriesInDb = row[0]

    log.write('playlist in database has '+str(entriesInDb)+' entries')

    if entriesInDb == linesInCsvFile:
        log.write('playlist and csvFile have the same number of recordings')
    else:
        log.write(
            'fatal error playlist and csvFile '
            'DO NOT HAVE SAME NUMBER OF RECORDINGS ERROR!!!!!!!!!!!!!!!!!!!!!'
        )
        quit()

    print 'started pipe'
    log.write('start classification pipe')
    sys.stdout.flush()
    log.write('starting cat of '+classificationFileName)
    p1 = subprocess.Popen(
        ['/bin/cat', classificationFileName], stdout=subprocess.PIPE)
    log.write('calling audiomapper/classifyMap.py')
    p2 = subprocess.Popen([
        currPython, currDir+'/audiomapper/classifyMap.py',
        str(jobId), str(linesInCsvFile)
    ], stdin=p1.stdout, stdout=subprocess.PIPE)
    log.write('calling audiomapper/recClassify.py')
    p3 = subprocess.Popen([
        currPython, currDir+'/audiomapper/recClassify.py',
        str(jobId), model_uri
    ], stdin=p2.stdout, stdout=subprocess.PIPE)
    log.write('calling audiomapper/classificationresults.py')
    p4 = subprocess.Popen([
        currPython, currDir+'/audiomapper/classificationresults.py',
        str(jobId), str(linesInCsvFile)
    ], stdin=p3.stdout, stdout=subprocess.PIPE)
    log.write('waiting for pipe to end')
    jOutput = p4.communicate()[0].strip('\n')
    # log.write('job output: '+jOutput)
    # print jOutput
    sys.stdout.flush()
    # update job progress
else:
    print("Unkown model type requested\n")
    log.write('Unkown model type requested')

with closing(db.cursor()) as cursor:
    cursor.execute("""
        UPDATE `jobs`
        SET `last_update` = NOW()
        WHERE `job_id` = %s
    """, [jobId])
    db.commit()

timestr = 'execution time: '+str(time.time() - start_time)
db.close()
log.write('script end')
log.write(timestr)
log.close()
print timestr
