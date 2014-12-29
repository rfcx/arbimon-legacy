import sys
from a2pyutils import colors
import a2pyutils.palette
from soundscape import soundscape


USAGE = """
{prog} peaks.csv max_hertz bin_size aggregation imageout.png scidxout.scidx [gradient.png]
    peaks.csv - peaks file (can be "-" for stdin)
    max_hertz - maximum hertz to represent
    bin_size  - size of bins in hertz
    aggregation - one of : {aggregations}
    imageout.png - image output file (.png or .bmp format)
    scidxout.scidx - index output file (scidx format)
    gradient.png - gradient legend output file (.png or .bmp format)
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
gradimgout = sys.argv[7] if len(sys.argv) >= 8 else None

max_bins = int(max_hertz / bin_size)

if not aggregation:
    print "# Wrong agregation."
    print USAGE
    sys.exit()

using_file = (peaks_file != "-")

try:
    finp = open(peaks_file, "r") if using_file else sys.stdin
    scp = soundscape.Soundscape(aggregation, bin_size, max_bins,finp)
finally:
    if using_file:
        finp.close()

# palette = colors.LinearGradient(
#     [[240, 100, 57], [17, 100, 98]],
#     [360, 100, 100], 255, spacetx=colors.hsv2rgb
# ).get_palette()

palette_id = 1
palette = a2pyutils.palette.get_palette(palette_id)

scp.write_image(imgout, palette=palette)
scp.write_index(scidxout)

if gradimgout:
    if imgout[:4] == ".png":
        import png
        W = png.Writer(
            width=width, height=height, bitdepth=bpp, palette=palette
        )
    else:
        from a2pyutils import bmpio
        W = bmpio.Writer

    w = W(width=1, height=len(palette), bitdepth=8, palette=palette)
    with file(gradimgout, "wb") as fout:
        w.write(fout, [[255 - i] for i in range(256)])
