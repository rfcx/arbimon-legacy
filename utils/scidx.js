var async = require('async');
var file = require('./file');

/** Reads a scidx file, given the filename.
 */
module.exports.read = function(filename, filter, callback){
    var index = {};
    
    if(filter instanceof Function){
        callback = filter;
        filter = null;
    }

    if(!filter){
        filter = {};
    }
    
    var minx = filter.minx === undefined ? filter.minx : -1/0.0, 
        maxx = filter.maxx === undefined ? filter.maxx :  1/0.0, 
        miny = filter.miny === undefined ? filter.miny : -1/0.0, 
        maxy = filter.maxy === undefined ? filter.maxy :  1/0.0;
        
    var finp;
    var buffer = new Buffer(100);
    var scidx = {index:{}};
    var row_pointers;
    var rcfmt;
        
    async.waterfall([
        function open_file(next){
            finp = new file(filename, "rb", function(err){ next(err); });
        },
        function read_sidx_header_part1(next){            
            // # read header
            // # file :
            // #     field 	desc
            // #     "SCIDX " 	6 byte magic number
            // #     version    2 byte uint
            // #     offsetx    2 byte uint
            // #     width    	2 byte uint
            // #     offsety    2 byte uint
            // #     height 	2 byte uint
            // #     rec_count 	3 byte uint
            // #     rec_bytes 	1 byte uint
            // #     rows_ptr_start array of 8 byte file offset from start - indicates
            // #                       begining of rows_ptr[] array
            // ## this is read later:
            // #     recs[] 	array of rec structures of size rec_count
            // #     rows_ptr[] 	array of 8 byte file offset from start - indicates
            // #                   begining of each entry of rows[]
            finp.unpack(">6sHHHHH3UBQ", 28, next);
        },
        function set_header_vals(upc, next){
            if(upc[0] != "SCIDX "){
                next(new Error("Invalid soundscape index file format."));
            }
            scidx.version   = upc[1];
            scidx.offsetx   = upc[2];
            scidx.width     = upc[3];
            scidx.offsety   = upc[4];
            scidx.height    = upc[5];
            scidx.rec_count = upc[6];
            scidx.rec_bytes = upc[7];
            scidx.rows_ptr_start = upc[8];

            rcfmt = ">" + ("B".repeat(scidx.rec_bytes));

            if(!filter.ignore_offsets){
                minx -= offsetx;
                maxx -= offsetx;
                miny -= offsety;
                maxy -= offsety;
            }

            next();                
        }, 
        function read_list_of_rec_ids(next){
            // # read list of recording ids
            // # rec structure :
            // #     field 	desc
            // #     rec_id 	8 byte uint - id of the recording in the database
            finp.unpack(">" + ("Q".repeat(scidx.rec_count)), 8 * scidx.rec_count, next);
        }, 
        function set_recs_list(upc, next){
            scidx.recordings = upc;
            next();
        },
        function read_row_ptrs(next){
            // # seek to pointer of start of row pointers array
            finp.seek(scidx.rows_ptr_start);
            // # read array of file positions of each row
            finp.unpack(">" + ("Q".repeat(scidx.height)), 8 * scidx.height, next);
        }, 
        function set_row_ptrs(upc, next){
            row_pointers = upc;
            next();
        },
        function read_rows(upc, next){
            // # read each row
            // # row structure :
            // #     field 	desc
            // #     cells_ptr[] 	array of 8 byte offsets from the beginning of the row
            // #                   structure - indicates begining of each entry of cells[]
            // #     cells[] 	array of cell structures of size width
            var yi = 0, ye = scidx.height;
            async.whilst(
                function(){ return yi < ye;}, 
                function read_row(read_next_row){
                    var y = yi;
                    ++yi;
                    var row_ptr = row_pointers[y];
                    if(row_ptr && miny <= y && y <= maxy){
                        var off_y, row, cell_pointers;
                        async.waterfall([
                            function setup_vars(w2_next){
                                off_y = offsety + y;
                                row = {};
                                scidx.index[off_y] = row;
                                w2_next();
                            },
                            function read_cell_ptrs(w2_next){
                                // # seek to the location of the current row
                                finp.seek(row_ptr);
                                // # syncer, = struct.unpack(">6s", finp.read(6))
                                // # print "(%s, %s) row : %r : %s <= %s <= %s :: %s x %s" % (
                                // #     hex(row_pointers[y]), hex(fendpos), syncer, miny, y,
                                // #     maxy, width, height
                                // # )
                                // # read array positions relative to row (one per cell)
                                finp.unpack(">" + ("Q".repeat(width)), 
                                    finp.read(8 * width), w2_next
                                );
                            },
                            function set_cell_ptrs(upc, w2_next){
                                cell_pointers = upc;
                                w2_next();
                            }, 
                            function read_cells(w2_next){
                                // # print cell_pointers
                                // # read each cell
                                // # cell structure :
                                // #     field 	desc
                                // #     count 	2 byte uint - number of recordings in indices[]
                                // #     indices[] 	array of rec_bytes byte uints of size count -
                                // #                   indicates indices in recs[] lists
                                var xi = 0, xf = scidx.width;
                                async.whilst(
                                    function(){ return xi < xf; },
                                    function read_cell(next_cell){
                                        var x = xi;
                                        ++xi;
                                        var cell_ptr = cell_pointers[y];
                                        var cell_count;
                                        if(cell_ptr && minx <= x && x <= maxx){
                                            // # seek to cell location denoted by cell_pointers[x],
                                            // # relative to row_pointers[y]
                                            // # finp.seek(cell_pointers[x] + row_pointers[y])
                                            finp.seek(cell_pointers[x]);
                                            // # syncer, = struct.unpack(">6s", finp.read(6))
                                            // # print "(%s, %s)   cell : %r : %s <= %s <= %s :: %s" % (
                                            // #     hex(cell_pointers[x]),
                                            // #     hex(fendpos),
                                            // #     syncer, minx, x,
                                            // #     maxx, width
                                            // # )
                                            async.waterfall([
                                                function fetch_cell_count(w3_next){
                                                    finp.unpack(">H", 2, w3_next);
                                                },
                                                function set_cell_count(upc, w3_next){
                                                    cell_count = upc[0];
                                                    w3_next();
                                                },
                                                function(w3_next){
                                                    finp.unpack(rcfmt.repeat(cell_count), rcbytes * cell_count, w3_next);
                                                },
                                                function(upc, w3_next){
                                                    row[offsetx + x] = upc.map(function(i){
                                                        return recordings[i];
                                                    });
                                                }
                                            ], next_cell);
                                            // # print cell_count, rcfmt, rcbytes
                                        } else {
                                            next_cell();
                                        }
                                    },
                                    w2_next
                                );                       
                            }
                        ], read_next_row);
                    } else {
                        read_next_row();
                    }
                },
                function(err){
                    if(err){ callback(err); } else { callback(null, scidx); }
                }
            );
        }
    ], function(err){
        if(err){
            callback(err);
        } else {
            callback(null, scidx);
        }
    });
};
