from a2pyutils import bmpio
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
    def __init__(self, aggregation, bin_size, max_bins,finp=None):
        "Constructs a soundscape from a peaks file"
        self.aggregation = aggregation
        self.start_bin = 0
        self.max_bins = max_bins
        self.bin_size = bin_size
        self.max_list_global = None
        bins = {}
        recordings = {}
        self.recstemp = {}
        max_list = None
        stats = {
            'min_idx': float('inf'),
            'max_idx': float('-inf'),
            'max_count': 0
        }
        
        if finp is None:
            self.recordings = recordings
        else:
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

    def insert_peaks(self,date,freqs,i_id):
        aggregation = self.aggregation
        max_bins = self.max_bins
        bin_size = self.bin_size
        max_list = self.max_list_global
        idx = int(sum([
           float(date.strftime(x)) * y for (x, y) in
           zip(aggregation['date'], aggregation['projection'])
        ]))
        self.stats['min_idx'] = min(self.stats['min_idx'], idx)
        self.stats['max_idx'] = max(self.stats['max_idx'], idx)
        for f in freqs:
            i_bin = min(
                    int(f * 1000 / bin_size),
                    max_bins
                )
            if i_id not in self.recstemp:
                self.recstemp[i_id] = 1
            if i_bin not in self.bins:
                self.bins[i_bin] = {}
            bin = self.bins[i_bin]
            if idx not in bin:
                bin[idx] = {}
            recs = bin[idx]
            if i_id not in recs:
                recs[i_id] = 1

            if not max_list or len(max_list) < len(recs):
                max_list = recs
        self.max_list_global = max_list
        self.stats['max_count'] = len(max_list) if max_list else 0
        self.recordings = self.recstemp
        self.recordings = self.recordings.keys()
        self.recordings.sort()
        
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

    def write_image(self, imgout, palette):
        "Writes the soundscape to an image file"

        agg_range = self.aggregation['range']
        if agg_range == 'auto':
            agg_range = [self.stats['min_idx'], self.stats['max_idx']]
        offsetx = agg_range[0]
        width = agg_range[1] - offsetx + 1
        height = self.max_bins
        bpp = 8

        if imgout[-4:] == ".png":
            w = png.Writer(
                width=width, height=height, bitdepth=bpp, palette=palette
            )
        else:
            w = bmpio.Writer(
                width=width, height=height, bitdepth=bpp, palette=palette
            )
        

        if  self.stats['max_count'] > 0 :
            fout = file(imgout, "wb")
            w.write(fout, self.rows_gen(
                self.bins, 255.0 / self.stats['max_count'],
                0, height, offsetx, offsetx + width
            ))
        else :
            print 'no data'

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

        if max_count > 0:
            scidx.write_scidx(
                indexout, bins, recordings,
                offsetx, width, offsety, height
            )
        else :
            print 'no data'
