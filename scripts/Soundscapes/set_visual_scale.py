#! .env/bin/python

import sys
import a2pyutils.palette
from soundscape.set_visual_scale_lib import run

USAGE = """
{prog} soundscape_id max_visual_scale [palette_id] [normalized] [amplitude]
    soundscape_id - id of the soundscape whose image to edit
    max_visual_scale - clip range maximum (if '-', then it is
                       computed automatically)
    palette_id - index of the gradient palette to use
                (defined in a2pyutils.palette)
    normalized - wether to normalize the the image by the
                number of recordings in analized per column.
    amplitude  - threshold the image using the given amplitude.
    amplitudeReference  - type of threshold to use (absolute or relative-to-peak-maximum).
""".format(
    prog=sys.argv[0]
)


def main(argv):
    if len(argv) < 3:
        print USAGE
        sys.exit()
    else:
        soundscapeId = int(argv[1])
        clipMax = None if argv[2] == '-' else int(argv[2])
        paletteId = (
            (int(argv[3]) if len(argv) > 3 else 0) %
            len(a2pyutils.palette.palette))
        normalized = int(argv[4] if len(argv) > 4 else 0) != 0
        amplitude_th = float(argv[5] if len(argv) > 5 else 0)
        amplitude_th_type = len(argv) > 6 and argv[6]
        run(soundscapeId, clipMax, paletteId, normalized, amplitude_th, amplitude_th_type)
        print 'end'

if __name__ == '__main__':
    main(sys.argv)
    import sys
    sys.stdout.flush()
