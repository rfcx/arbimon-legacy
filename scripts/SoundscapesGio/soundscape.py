import struct
import colors
import scidx
from datetime import datetime


aggregations = {
    'time_of_day'   : {
        'date' : ['%H'], 'projection' : [1], 'range': [0, 23]
    },
    'day_of_month'  : {
        'date' : ['%d'], 'projection' : [1], 'range': [1, 31]
    },
    'day_of_year'   : {
        'date' : ['%j'], 'projection' : [1], 'range': [1,366]
    },
    'month_in_year' : {
        'date' : ['%m'], 'projection' : [1], 'range': [1, 12]
    },
    'day_of_week'   : {
        'date' : ['%w'], 'projection' : [1], 'range': [0,  6]
    },
    'year'          : {
        'date' : ['%Y'], 'projection' : [1], 'range': 'auto'
    }
}

class Soundscape():
    def __init__(self, csv, aggregation, bin_size, max_bins):
        "Constructs a soundscape from a peaks file"
        self.aggregation = aggregation
        self.start_bin = 0
        self.max_bins    = max_bins
        self.bin_size    = bin_size
        
        bins = {}
        recordings = {}
        max_list = None
        stats = {
            'min_idx' : float('inf'),
            'max_idx' : float('-inf'),
            'max_count': 0
        }
        
        for i in self.get_peak_list(csv):
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
                
        stats['max_count'] = len(max_list) if max_list else 0;
        self.recordings = recordings.keys()
        self.recordings.sort()
        self.bins = bins
        self.stats = stats
        
    def get_peak_list(self, csv):
        "Generator that reads a file and yields peaks in an aggregated form"
        aggregation = self.aggregation
        max_bins = self.max_bins
        bin_size = self.bin_size
        hwhitelist = ["date", "id", "PeaksFrec"]
        header=[]
        with open(csv, "r") as finp:
            for i, l in enumerate(finp):
                if i == 0:
                    headers=[x.strip() for x in l.split(',')]
                else:
                    l = dict([(x,y) for (x,y) in zip(
                        headers,
                        [x.strip() for x in l.split(',')]
                    ) if x in hwhitelist])
                    date = datetime.strptime(l['date'], '%m/%d/%Y %I:%M %p')
                    l['idx'] = int(sum([float(date.strftime(x)) * y for (x,y) in zip(aggregation['date'], aggregation['projection'])]))                
                    l['bin']  = min(int(float(l['PeaksFrec']) *  1000 / bin_size), max_bins)
                    
                    del l['date']
                    del l['PeaksFrec']
                    yield l
                    
    def write_image(self, imgout):
        "Writes the soundscape to an image file"
        bins = self.bins
        max_count = self.stats['max_count']
        agg_range = self.aggregation['range']
        if agg_range == 'auto':
            offsetx = self.stats['min_idx']
            width   = self.stats['max_idx'] - offsetx + 1
        else :
            offsetx = agg_range[0]
            width   = agg_range[1] - offsetx + 1
        bits_per_pixel =  8
        rowsize  = int((bits_per_pixel * width + 31)/32)*4
        wpadding = rowsize - width
        height = self.max_bins
        img_size       = rowsize * height * bits_per_pixel/8
        pallette_size  = 256 * 4
        img_start_off  = 40 + 14 + pallette_size
        file_size      = img_start_off + img_size
        header = [
            "BM", file_size, 0, 0, img_start_off,
            40, width, -height, 1, bits_per_pixel, 0, img_size,
            100, 100,
            256, 0
        ]
        
        # print header, rowsize, wpadding
        
        fout = file(imgout, "wb")
        fout.write(struct.pack("<2sIHHIIiiHHIIiiII", *header))
        gradient = colors.Gradient([
            [240,100, 57], 
            [ 17, 100, 98]
        ], [360,100,100], 255, spacetx = colors.hsv2rgb)
        for i in range(256):
            r, g, b = gradient(i / 255.0)
            fout.write(struct.pack("<BBBB", b, g, r, 0));
            
        for y in range(height-1, -1, -1):
            for x in range(offsetx, offsetx + width):
                v, c = None, 0
                if y in bins:
                    bin = bins[y]
                    if x in bin:
                        v = bin[x]
                        c = int(len(v) * 255 / max_count);
                # print (v, c),
                fout.write(struct.pack("<B", c));
            for x in range(0, wpadding):
                fout.write(struct.pack("<B", 0));
            # print
    
    def write_index(self, indexout):
        bins = self.bins
        recordings = self.recordings
        max_count = self.stats['max_count']
        agg_range = self.aggregation['range']
        if agg_range == 'auto':
            offsetx = self.stats['min_idx']
            width   = self.stats['max_idx'] - offsetx + 1
        else :
            offsetx = agg_range[0]
            width   = agg_range[1] - offsetx + 1
        offsety = 0
        height  = self.max_bins
        
        scidx.write_scidx(indexout, bins, recordings, offsetx, width, offsety, height)
        
