import sys
import soundscape


USAGE = """
{prog} peaks.csv max_hertz bin_size aggregation imageout.png scidxout.scidx
    peaks.csv - peaks file (can be "-" for stdin)
    max_hertz - maximum hertz to represent
    bin_size  - size of bins in hertz
    aggregation - one of : {aggregations}
    imageout.png - image output file (.png or .bmp format)
    scidxout.scidx - index output file (scidx format)
""".format(
    prog=sys.argv[0],
    aggregations=', '.join(soundscape.aggregations.keys())
)


if len(sys.argv) < 7:
    print USAGE
    sys.exit()

peaks_file = sys.argv[1]
max_hertz = int(sys.argv[2])
bin_size = int(sys.argv[3])
aggregation = soundscape.aggregations.get(sys.argv[4])
imgout = sys.argv[5]
scidxout = sys.argv[6]

max_bins = int(max_hertz / bin_size)

if not aggregation:
    print "# Wrong agregation."
    print USAGE
    sys.exit()

using_file = (peaks_file != "-")

try:
    finp = open(peaks_file, "r") if using_file else sys.stdin
    scp = soundscape.Soundscape(finp, aggregation, bin_size, max_bins)
finally:
    if using_file:
        finp.close()

scp.write_image(imgout)
scp.write_index(scidxout)

# print scp.recordings, scp.stats
# print aggregation['range']
