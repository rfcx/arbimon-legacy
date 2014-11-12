from a2pyutils import bmpio, colors
import png
import scidx
from datetime import datetime


aggregations = {
    'time_of_day': {
        'date': ['%H'], 'projection': [1], 'range': [0,  23]
    },
    'day_of_month': {
        'date': ['%d'], 'projection': [1], 'range': [1,  31]
    },
    'day_of_year': {
        'date': ['%j'], 'projection': [1], 'range': [1, 366]
    },
    'month_in_year': {
        'date': ['%m'], 'projection': [1], 'range': [1,  12]
    },
    'day_of_week': {
        'date': ['%w'], 'projection': [1], 'range': [0,   6]
    },
    'year': {
        'date': ['%Y'], 'projection': [1], 'range': 'auto'
    }
}


class Soundscape():
    def __init__(self, finp, aggregation, bin_size, max_bins):
        "Constructs a soundscape from a peaks file"
        self.aggregation = aggregation
        self.start_bin = 0
        self.max_bins = max_bins
        self.bin_size = bin_size

        bins = {}
        recordings = {}
        max_list = None
        stats = {
            'min_idx': float('inf'),
            'max_idx': float('-inf'),
            'max_count': 0
        }

        for i in self.get_peak_list(finp):
            i_bin, i_idx, i_id = (i['bin'], i['idx'], i['id'])
            stats['min_idx'] = min(stats['min_idx'], i_idx)
            stats['max_idx'] = max(stats['max_idx'], i_idx)

            if i_id not in recordings:
                recordings[i_id] = 1
            if i_bin not in bins:
                bins[i_bin] = {}
            bin = bins[i_bin]
            if i_idx not in bin:
                bin[i_idx] = {}
            recs = bin[i_idx]
            if i_id not in recs:
                recs[i_id] = 1

            if not max_list or len(max_list) < len(recs):
                max_list = recs

        stats['max_count'] = len(max_list) if max_list else 0
        self.recordings = recordings.keys()
        self.recordings.sort()
        self.bins = bins
        self.stats = stats

    def get_peak_list(self, finp):
        "Generator that reads a file and yields peaks in an aggregated form"
        aggregation = self.aggregation
        max_bins = self.max_bins
        bin_size = self.bin_size
        hwhitelist = ["date", "id", "PeaksFrec"]
        header = []
        for i, l in enumerate(finp):
            if i == 0:
                headers = [x.strip() for x in l.split(',')]
            else:
                l = dict([(x, y) for (x, y) in zip(
                    headers,
                    [x.strip() for x in l.split(',')]
                ) if x in hwhitelist])
                date = datetime.strptime(l['date'], '%m/%d/%Y %I:%M %p')
                l['idx'] = int(sum([
                    float(date.strftime(x)) * y for (x, y) in
                    zip(aggregation['date'], aggregation['projection'])
                ]))
                l['bin'] = min(
                    int(float(l['PeaksFrec']) * 1000 / bin_size),
                    max_bins
                )

                del l['date']
                del l['PeaksFrec']
                yield l

    @staticmethod
    def cols_gen(bin, scale, from_x, to_x):
        "yields counts for each column in a cell"
        for x in range(from_x, to_x):
            v = len(bin[x]) if bin and x in bin else 0
            yield int(v * scale)

    @classmethod
    def rows_gen(cls, bins, scale, from_y, to_y, from_x, to_x):
        "yields column iterators for each row in the index"
        for y in range(to_y-1, from_y-1, -1):
            yield cls.cols_gen(bins.get(y), scale, from_x, to_x)

    def write_image(self, imgout):
        "Writes the soundscape to an image file"

        agg_range = self.aggregation['range']
        if agg_range == 'auto':
            agg_range = [self.stats['min_idx'], self.stats['max_idx']]

        offsetx = agg_range[0]
        width = agg_range[1] - offsetx + 1
        height = self.max_bins
        bpp = 8

        gradient = colors.Gradient(
            [[240, 100, 57], [17, 100, 98]],
            [360, 100, 100], 255, spacetx=colors.hsv2rgb
        )
        palette = [gradient(i / 255.0) for i in range(256)]

        if imgout[:4] == ".png":
            w = pypng.Writer(
                width=width, height=height, bitdepth=bpp, palette=palette
            )
        else:
            w = bmpio.Writer(
                width=width, height=height, bitdepth=bpp, palette=palette
            )
        fout = file(imgout, "wb")

        w.write(fout, self.rows_gen(
            self.bins, 255.0 / self.stats['max_count'],
            0, height, offsetx, offsetx + width
        ))

    def write_index(self, indexout):
        bins = self.bins
        recordings = self.recordings
        max_count = self.stats['max_count']
        agg_range = self.aggregation['range']
        if agg_range == 'auto':
            offsetx = self.stats['min_idx']
            width = self.stats['max_idx'] - offsetx + 1
        else:
            offsetx = agg_range[0]
            width = agg_range[1] - offsetx + 1
        offsety = 0
        height = self.max_bins

        scidx.write_scidx(
            indexout, bins, recordings,
            offsetx, width, offsety, height
        )
