import sys
import MySQLdb
import tempfile
import os
import shutil
import math
import multiprocessing
import subprocess
from joblib import Parallel, delayed  
from datetime import datetime
from contextlib import closing
from soundscape import soundscape
from a2pyutils.config import Config
from a2pyutils.logger import Logger
from a2audio.rec import Rec

##to do
# job progrss in jobs table
#
#
#
##
#will change this to a external configuration file
num_cores = int(math.floor(multiprocessing.cpu_count() /2))

currDir = (os.path.dirname(os.path.realpath(__file__)))
USAGE = """
{prog} job_id playlist_id max_hertz bin_size aggregation imageout.png scidxout.scidx
    job_id - job id in database
    playlist_id - playlist id in database
    max_hertz - maximum hertz to represent
    bin_size  - size of bins in hertz 
    aggregation - one of : {aggregations}
    imageout.png - image output file (.png or .bmp format)
    scidxout.scidx - index output file (scidx format)
""".format(
    prog=sys.argv[0],
    aggregations=', '.join(soundscape.aggregations.keys())
)


if len(sys.argv) < 8:
    print USAGE
    sys.exit()

job_id = int(sys.argv[1])
playlist_id = int(sys.argv[2])
max_hertz = int(sys.argv[3])
bin_size = int(sys.argv[4])
aggregation = soundscape.aggregations.get(sys.argv[5])
imgout = sys.argv[6]
scidxout = sys.argv[7]
tempFolders = tempfile.gettempdir()
workingFolder = tempFolders+"/soundscape_"+str(job_id)+"/"
if os.path.exists(workingFolder):
    shutil.rmtree(workingFolder)
os.makedirs(workingFolder)

log = Logger(job_id , 'playlist2soundscape.py' , 'main')
log.write('script started')

if bin_size < 0 :
    print "# Bin size must be a positive number. Input was: " +str(bin_size)
    print USAGE
    log.write('Bin size must be a positive number. Input was: ' +str(bin_size))
    log.close()
    sys.exit()
    
max_bins = int(max_hertz / bin_size)

if not aggregation:
    print "# Wrong agregation."
    print USAGE
    log.write('Wrong agregation')
    log.close()
    sys.exit()

configuration = Config()
config = configuration.data()
log.write('configuration loaded')
log.write('trying database connection')
try:
    db = MySQLdb.connect(host=config[0], user=config[1], passwd=config[2],db=config[3])
except MySQLdb.Error as e:
    print "# fatal error cannot connect to database ."
    log.write('fatal error cannot connect to database with credentials: '+config[0]+' '+config[1]+' '+config[2]+' '+config[3])
    log.close()
    quit()
log.write('database connection succesful')

q=("SELECT r.`recording_id`,`uri`, DATE_FORMAT( `datetime` , '%Y-%m-%d %H:%i:%s' ) as date FROM `playlist_recordings` pr , `recordings` r "+
  "WHERE `playlist_id` = "+str(playlist_id)+" and pr.`recording_id` = r.`recording_id`")

recsToProcess = []
with closing(db.cursor()) as cursor:
        cursor.execute(q)
        db.commit()
        numrows = int(cursor.rowcount)
        for i in range(0,numrows):
            row = cursor.fetchone()
            recsToProcess.append({"uri":row[1],"id":row[0],"date":row[2]})

if len(recsToProcess) < 1:
    print "# fatal error invalid playlist or no recordings on playlist."
    log.write('Invalid playlist or no recordings on playlist')
    log.close()
    sys.exit()
    


def processRec(rec):
    results = []
    date = datetime.strptime( rec['date'], '%Y-%m-%d %H:%M:%S')
    id = rec['id']
    uri = rec['uri']    
    recobject = Rec(uri,workingFolder,config,config[4],False)
    
    if recobject .status == 'HasAudioData':
        localFile = recobject.getLocalFileLocation()
        proc = subprocess.Popen(['/usr/bin/Rscript',currDir+'/fpeaks.R' , localFile , 'a'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        stdout, stderr = proc.communicate()
        if stderr:
            print 'error:',uri, stderr
            log.write('Error in recording:'+ uri )
            with closing(db.cursor()) as cursor:
                cursor.execute('INSERT INTO `recordings_errors`(`recording_id`, `job_id`) VALUES ('+str(id)+','+str(job_id)+') ')
                db.commit()
            return None
        elif stdout:
            results = {"date":date,"id":id,"freqs":stdout}
            return results
    else:
        print 'invalid recording:'+uri
        log.write('Invalid recording:'+ uri )
        with closing(db.cursor()) as cursor:
            cursor.execute('INSERT INTO `recordings_errors`(`recording_id`, `job_id`) VALUES ('+str(id)+','+str(job_id)+') ')
            db.commit()
        return None

resultsParallel = Parallel(n_jobs=num_cores)(delayed(processRec)(rec) for rec in recsToProcess)

scp = soundscape.Soundscape(aggregation, bin_size, max_bins)

if len(resultsParallel)>0:
    log.write('processing recordings results: '+str(len(resultsParallel))) 
    for result in resultsParallel:
        if result != None:
            freqs = result['freqs'].strip(',')
            freqs = [float(i) for i in freqs.split(',')]
            if len(freqs) > 0 :
                scp.insert_peaks(result['date'],freqs,result['id'])
    scp.write_image(imgout)
    scp.write_index(scidxout)
    """
    save to bucket (project_2/soundscapes/1/image.png)
    save to database (soundscape_id 	name 	project_id 	user_id 	soundscape_aggregation_type_id 	bin_size 	uri 	min_t 	max_t 	min_f 	max_f 	min_value 	max_value )
    """
else:
    print 'no results from playlist id:'+playlist_id
    log.write('no results from playlist id:'+playlist_id) 


print scp.recordings, scp.stats
print aggregation['range']
log.write('ended script')
log.close()
db.close()
