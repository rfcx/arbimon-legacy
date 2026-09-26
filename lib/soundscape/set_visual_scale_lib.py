import MySQLdb
import MySQLdb.cursors
from a2pyutils import colors
from contextlib import closing
from a2pyutils.config import Config
import sys
import boto.s3.connection


def exit_error(msg, code=-1, log=None):
    print '<<<ERROR>>>\n{}\n<<<\ERROR>>>'.format(msg)
    if log:
        log.write('\n<<<ERROR>>>\n{}\n<<<\ERROR>>>'.format(msg))
    sys.exit(code)


def get_db(config):
    db = None
    try:
        db = MySQLdb.connect(
            host=config[0], user=config[1], passwd=config[2], db=config[3],
            cursorclass=MySQLdb.cursors.DictCursor
        )
    except MySQLdb.Error as e:
        exit_error("cannot connect to database.")
    if not db:
        exit_error("cannot connect to database.")
    return db


def get_sc_data(db, soundscape_id):
    sc_data = None
    with closing(db.cursor()) as cursor:
            cursor.execute("""
                SELECT S.uri, S.playlist_id, SAT.identifier as aggregation
                FROM soundscapes S
                JOIN soundscape_aggregation_types SAT ON S.soundscape_aggregation_type_id = SAT.soundscape_aggregation_type_id
                WHERE soundscape_id = %s
            """,
                [soundscape_id]
            )
            sc_data = cursor.fetchone()
    if not sc_data:
        exit_error("Soundscape #{} not found".format(soundscape_id))
    return sc_data


def get_bucket(config):
    bucketName = config[4]
    awsKeyId = config[5]
    awsKeySecret = config[6]
    region = config[8]
    conn = None
    bucket = None
    try:
        conn = boto.s3.connection.S3Connection(awsKeyId, awsKeySecret, host='s3.{}.amazonaws.com'.format(region))
    except:
        exit_error('cannot not connect to aws.')
    if not conn:
        exit_error('cannot not connect to aws.')
    else:
        try:
            bucket = conn.get_bucket(bucketName, validate=False)
        except Exception, ex:
            exit_error('cannot not connect to bucket.')
        if not bucket:
            exit_error('cannot not connect to bucket.')
    return bucket


def update_db(db, clip_max, palette_id, soundscape_id, normalized,
              amplitude_th, amplitude_th_type):
    try:
        with closing(db.cursor()) as cursor:
            cursor.execute("""
                UPDATE `soundscapes`
                SET visual_max_value = %s, visual_palette = %s,
                    normalized = %s, threshold = %s,
                    threshold_type = %s
                WHERE soundscape_id = %s
            """, [
                clip_max, palette_id, int(normalized), amplitude_th,
                amplitude_th_type,
                soundscape_id
            ])
            db.commit()
    except:
        print 'WARNING: Cannot update database soundscape information'


def run(soundscape_id, clip_max, palette_id, normalized=0, amplitude_th=0.0, amplitude_th_type='absolute'):
    configuration = Config()
    config = configuration.data()

    db = get_db(config)

    get_sc_data(db, soundscape_id)  # exits with an error if the id is unknown

    # 2026-09-25 (operator 20:37): no longer re-render + re-upload a
    # (world-readable) image.png on a scale/palette change. Every consumer
    # renders the heat-map from index.scidx using the row's visual settings
    # (app/utils/soundscape-image.js server-side, the SPA canvas client-side),
    # and those renders key their cache on the settings (`v=` in the url), so
    # persisting the settings below is all a scale change needs.
    # clip_max None ('-' = auto) is stored as NULL exactly as before; the
    # renderers read NULL visual_max_value as "use the data maximum".

    update_db(db, clip_max, palette_id, soundscape_id, normalized, amplitude_th, amplitude_th_type)

    db.close()
