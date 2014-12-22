#! .env/bin/python

import os
import os.path
import sys
import subprocess

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
    scriptsFolder+'PatternMatching/classification.py',
    job_id, name, allRecs, sitesString,
    classifier, project, user, playlist
]


code = subprocess.call(cmd)

if code != 0:
    debug('classificationJob returned error', job_id)
else:
    debug('no error, everything ok, classificationJob completed', job_id)

    debug("job done! classificationJob", job_id)
    model.projects.insertNews({
        news_type_id: 9, // model created and trained
        user_id: req.session.user.id,
        project_id: project,
        data: JSON.stringify({model: rows[0].name, classi: name})
    })
