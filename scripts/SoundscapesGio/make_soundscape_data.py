import sys
import soundscape


USAGE = """
{prog} peaks.csv max_hertz bin_size aggregation imageout.bmp scidxout.scidx
    peaks.csv - peaks file
    max_hertz - maximum hertz to represent
    bin_size  - size of bins in hertz
    aggregation - one of : {aggregations}
    imageout.bmp - image file (bmp format)
""".format(
    prog = sys.argv[0],
    aggregations = ', '.join(soundscape.aggregations.keys())
)



if len(sys.argv) < 7:
    print USAGE
    sys.exit()
    
csv         = sys.argv[1]
max_hertz   = int(sys.argv[2])
bin_size    = int(sys.argv[3])
aggregation = soundscape.aggregations.get(sys.argv[4])
imgout      = sys.argv[5]
scidxout    = sys.argv[6]

max_bins = int(max_hertz / bin_size)

if not aggregation:
    print "# Wrong agregation."
    print USAGE
    sys.exit()

    

        

scp = soundscape.Soundscape(csv, aggregation, bin_size, max_bins)
scp.write_image(imgout);
scp.write_index(scidxout);

# print scp.recordings, scp.stats
# print aggregation['range']
