import struct
import math

VERSION = 1


class file_pointer_write_loc(object):
    def __init__(self, f, relative_pos=0):
        self.f = f
        self.pos = f.tell()
        self.relative_pos = relative_pos
        f.write(struct.pack(">Q", 0))

    def update(self):
        f = self.f
        pos = f.tell()
        wpos = pos
        if self.relative_pos:
            wpos -= self.relative_pos

        f.seek(self.pos)
        f.write(struct.pack(">Q", wpos))
        f.seek(pos)


def uint2BEbytes(x, n):
    return [(x >> (8*i)) & 0xff for i in range(n-1, -1, -1)]


def BEbytes2uint(b):
    return sum([long(b[i]) << (8*(len(b) - 1 - i)) for i in range(len(b))])


def write_scidx(filename, index, recordings, offsetx, width, offsety, height):
    "Writes a scidx file to the given filename, given the index attributes"
    fout = file(filename, "wb")
    rcount = len(recordings)
    rcbytes = int(math.ceil(math.log(rcount, 2)/8.0))
    rcfmt = ">" + ("B"*rcbytes)
    rec_idx = {}
    # write header
    # file :
    #     field 	desc
    #     "SCIDX " 	6 byte magic number
    #     version   2 byte uint
    #     width 	2 byte uint
    #     height 	2 byte uint
    #     rec_count 	3 byte uint
    #     rec_bytes 	1 byte uint
    #     rows_ptr_start 	array of 8 byte file offset from start - indicates
    #                       begining of rows_ptr[] array
    #     recs[] 	array of rec structures of size rec_count
    #     rows_ptr[] 	array of 8 byte file offset from start - indicates
    #                       begining of each entry of rows[]
    #     rows[] 	array of row structures of size height
    fout.write(struct.pack(
        ">6sHHHHH",
        "SCIDX ", VERSION, offsetx, width, offsety, height
    ))
    fout.write(struct.pack(">BBB", *uint2BEbytes(rcount, 3)))
    fout.write(struct.pack(">B", rcbytes))
    # setup file_pointer_write_loc for writing start of row pointers array
    rows_ptr_start = file_pointer_write_loc(fout)
    # write list of recording ids
    # rec structure :
    #     field 	desc
    #     rec_id 	8 byte uint - id of the recording in the database
    for i, rec in enumerate(recordings):
        fout.write(struct.pack(">Q", int(rec)))
        rec_idx[rec] = i
    # update the rows_ptr_start location to the current file position
    rows_ptr_start.update()
    # setup an array of file positions (one per row)
    row_pointers = [file_pointer_write_loc(fout) for y in range(height)]
    # write each row
    # row structure :
    #     field 	desc
    #     cells_ptr[] 	array of 8 byte offsets from the beginning of the
    #                   row structure - indicates begining of each entry of
    #                   cells[]
    #     cells[] 	array of cell structures of size width
    for y in range(height):
        off_y = offsety + y
        # if the row is in the index, then:::
        if off_y in index:
            # update the row_pointers[y] location to the current file position
            row_pointers[y].update()
            row = index[off_y]
            # setup an array of positions relative to row (one per cell)
            cell_pointers = [
                file_pointer_write_loc(fout, row_pointers[y].pos)
                for x in range(width)
            ]
            # write each cell
            # cell structure :
            #     field 	desc
            #     count 	2 byte uint - number of recordings in indices[]
            #     indices[] 	array of rec_bytes byte uints of size count -
            #                   indicates indices in recs[] lists
            for x in range(width):
                off_x = offsetx + x
                # if the row is in the index, then:::
                if off_x in row:
                    # update the cell_pointers[x] location to the current
                    # file position, relative to row_pointers[y]
                    cell_pointers[x].update()
                    cell = row[off_x]
                    fout.write(struct.pack(">H", len(cell)))
                    for rec in cell:
                        fout.write(struct.pack(
                            rcfmt, *uint2BEbytes(rec_idx[rec], rcbytes)
                        ))


def read_scidx(filename, filter=None):
    "Reads a scidx file, given the filename"
    index = {}

    if not filter:
        filter = {}
    minx, maxx, miny, maxy = [filter.get(f, v) for f, v in zip(
        ['minx', 'maxx', 'miny', 'maxy'],
        [float('-inf'), float('inf'), float('-inf'), float('inf')],
    )]

    fin = file(filename, "rb")
    # read header
    # file :
    #     field 	desc
    #     "SCIDX " 	6 byte magic number
    #     version   2 byte uint
    #     width 	2 byte uint
    #     height 	2 byte uint
    #     rec_count 	3 byte uint
    #     rec_bytes 	1 byte uint
    #     rows_ptr_start 	array of 8 byte file offset from start - indicates
    #                       begining of rows_ptr[] array
    #     recs[] 	array of rec structures of size rec_count
    #     rows_ptr[] 	array of 8 byte file offset from start - indicates
    #                   begining of each entry of rows[]
    #     rows[] 	array of row structures of size height
    magic, VERSION, offsetx, width, offsety, height = struct.unpack(
        ">6sHHHHH", fin.read(12)
    )

    if not filter.get("ignore_offsets", False):
        minx -= offsetx
        maxx -= offsetx
        miny -= offsety
        maxy -= offsety

    rcount = BEbytes2uint(struct.unpack(">BBB", fin.read(3)))
    rcbytes, = struct.unpack(">B", fin.read(1))
    rcfmt = ">" + ("B"*rcbytes)
    # read pointer of start of row pointers array
    rows_ptr_start, = struct.unpack(">Q", fin.read(8))
    # read list of recording ids
    # rec structure :
    #     field 	desc
    #     rec_id 	8 byte uint - id of the recording in the database
    recordings = [struct.unpack(">Q", fin.read(8)) for i in range(rcount)]
    # seek to pointer of start of row pointers array
    fin.seek(rows_ptr_start)
    # read array of file positions of each row
    row_pointers = [struct.unpack(">Q", fin.read(8)) for y in range(height)]
    # read each row
    # row structure :
    #     field 	desc
    #     cells_ptr[] 	array of 8 byte offsets from the beginning of the row
    #                   structure - indicates begining of each entry of cells[]
    #     cells[] 	array of cell structures of size width
    for y in range(height):
        if row_pointers[y] and miny <= y <= maxy:
            # seek to the location of the current row
            finp.seek(row_pointers[y])
            off_y = offsety + y
            row = {}
            index[off_y] = row
            # read array positions relative to row (one per cell)
            cell_pointers = [
                struct.unpack(">Q", fin.read(8))
                for y in range(width)
            ]
            # read each cell
            # cell structure :
            #     field 	desc
            #     count 	2 byte uint - number of recordings in indices[]
            #     indices[] 	array of rec_bytes byte uints of size count -
            #                   indicates indices in recs[] lists
            for x in range(width) and minx <= x <= maxx:
                if cell_pointers[x]:
                    # seek to cell location denoted by cell_pointers[x],
                    # relative to row_pointers[y]
                    fin.seek(cell_pointers[x] + row_pointers[y])
                    cell_count, = struct.unpack(">H", fin.read(2))
                    row[offsetx + x] = [
                        recordings[BEbytes2uint(struct.pack(
                            rcfmt, fin.read(rcbytes)
                        ))]
                        for i in range(cell_count)
                    ]
    return (index, recordings, offsetx, width, offsety, height)
