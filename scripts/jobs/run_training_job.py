#! .env/bin/python

import os
import os.path
import sys
import subprocess
import sys


USAGE = """Runs a model training jobTrains
{prog} job_id
    job_id - job id in database
""".format(prog=sys.argv[0])


def debug(*args):
    print ' '.join(args)

if len(sys.argv) < 2:
    print USAGE
    sys.exit(-1)

job_id = int(sys.argv[1].strip("'"))

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


sys.exit(-1)
# TODO


cmd = [
    '.env/bin/python',
    scriptsFolder+'PatternMatching/training.py',
    job_id,
    name
]

code = subprocess.call(cmd)

if code != 0:
    debug('trainingJob returned error ', job_id)
else:
    debug('no error, everything ok, trainingJob completed ', job_id)

    debug("job done! trainingJob", job_id, data)
    model.projects.insertNews({
        news_type_id: 8,  # model created and trained
        user_id: req.session.user.id,
        project_id: project_id,
        data: JSON.stringify({model: name, training_set: rows[0].name})
    })
