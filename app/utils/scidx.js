var async = require('async');
var file = require('./file');

var str_repeat = function(string, times) {
    if(!string.length || !times){
        return '';
    }
    var result = '';
    while (times > 0) {
        if (times & 1){ 
            result += string;
        }
        times >>= 1;
        string += string;
    }
    return result;
};

var scidx = function(index){
    this.index = index || {};
    this.valid = false;
    this.offsetx   = 0;
    this.width     = 0;
    this.offsety   = 0;
    this.height    = 0;
    this.recordings = [];
};

scidx.prototype = {
    /** Reads a scidx file, given the filename.
     */
    read : function(filename, filter, callback){
        if(filter instanceof Function){
            callback = filter;
            filter = null;
        }

        if(!filter){
            filter = {};
        }

        var _ = {
            index : this.index,
            just_count: filter.just_count,
            box   : {
                minx : filter.minx !== undefined ? filter.minx : -1/0.0, 
                maxx : filter.maxx !== undefined ? filter.maxx :  1/0.0, 
                miny : filter.miny !== undefined ? filter.miny : -1/0.0, 
                maxy : filter.maxy !== undefined ? filter.maxy :  1/0.0
            },
            stats:{maxAmp:0},
        };
        this.stats = _.stats;
            
        async.waterfall([
            function open_file(next){
                _.finp = new file(filename, "r", function(err){ next(err); });
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
                _.finp.unpack(">6sHHHHH3UBQ", 28, next);
            },
            (function set_header_vals(upc, next){
                if(upc[0] != "SCIDX "){
                    next(new Error("Invalid soundscape index file format."));
                    return;
                }
                this.version   = _.version   = upc[1];
                this.offsetx   = _.offsetx   = upc[2];
                this.width     = _.width     = upc[3];
                this.offsety   = _.offsety   = upc[4];
                this.height    = _.height    = upc[5];
                _.rec_count      = upc[6];
                _.rec_bytes      = upc[7];
                _.rows_ptr_start = upc[8];
                _.rcfmt = (_.rec_bytes + "U");

                if(!filter.ignore_offsets){
                    _.box.minx -= _.offsetx;
                    _.box.maxx -= _.offsetx;
                    _.box.miny -= _.offsety;
                    _.box.maxy -= _.offsety;
                }

                next();                
            }).bind(this), 
            function read_list_of_rec_ids(next){
                // # read list of recording ids
                // # rec structure :
                // #     field 	desc
                // #     rec_id 	8 byte uint - id of the recording in the database
                _.finp.unpack(">" + (str_repeat("Q", _.rec_count)), 8 * _.rec_count, next);
            },
            (function set_recs_list(upc, next){
                this.recordings = _.recordings = upc;
                next();
            }).bind(this),
            function read_row_ptrs(next){
                // # seek to pointer of start of row pointers array
                _.finp.seek(_.rows_ptr_start);
                // # read array of file positions of each row
                _.finp.unpack(">" + (str_repeat("Q", _.height)), 8 * _.height, next);
            }, 
            function set_row_ptrs(upc, next){
                _.row_pointers = upc;
                next();
            },
            (function(next){
                this.__read_rows(_, next);
            }).bind(this)
        ], (function(err){
            if(_.just_count){
                delete this.recordings;
            }
            if(_.finp){
                _.finp.close((function(err2){
                    if(err){
                        callback(err);
                    } else if(err2){
                        callback(err2);
                    } else {
                        this.valid = true;
                        callback(null, this);
                    }
                }).bind(this));
            } else {
                if(err){
                    callback(err);
                } else {
                    this.valid = true;
                    callback(null, this);
                }
            }
        }).bind(this));
    }, 
    __read_rows: function(_, callback){
        // var yi = 0, ye = _.height;
        var yi = 0;
        var h = _.height;
        // # read each row
        async.whilst(
            function(){ return yi < h;}, 
            (function read_row(read_next_row){
                _.y = yi;
                ++yi;
                this.__read_one_row(_, read_next_row);

            }).bind(this), callback
        );
    },
    __read_one_row : function (_, callback){
        var y       = _.y;
        var row_ptr = _.row_pointers[y];
        var miny    = _.box.miny, maxy = _.box.maxy;
        var index   = _.index;
        var oy;
        // # row structure :
        // #     field 	desc
        // #     cells_ptr[] 	array of 8 byte offsets from the beginning of the row
        // #                   structure - indicates begining of each entry of cells[]
        // #     cells[] 	array of cell structures of size width
        var read_row_data = miny <= y && y <= maxy;
        _.read_row_data = read_row_data;
        if(row_ptr){
            async.waterfall([
                function setup_vars(next){
                    oy = _.offsety + y;
                    _.row = index[oy] || {};
                    next();
                },
                function read_cell_ptrs(next){
                    // # seek to the location of the current row
                    _.finp.seek(row_ptr);
                    // # read array positions relative to row (one per cell)
                    _.finp.unpack(">" + (str_repeat("Q", _.width)), 8 * _.width, next
                    );
                },
                function set_cell_ptrs(upc, next){
                    _.cell_pointers = upc;
                    next();
                }, 
                (function read_cells(next){
                    this.__read_cells(_, next);
                }).bind(this),
                function add_row(cells_read_count, next){
                    if(cells_read_count && read_row_data){
                        index[oy] = _.row;
                    }
                    next();
                }
            ], callback);
        } else {
            callback();
        }
    },
    __read_cells : function (_, callback){
        // # print cell_pointers
        // # read each cell
        // # cell structure :
        // #     field 	desc
        // #     count 	2 byte uint - number of recordings in indices[]
        // #     indices[] 	array of rec_bytes byte uints of size count -
        // #                   indicates indices in recs[] lists
        // var xi = 0, xf = _.width;
        var xi = 0;
        var w = _.width;
        var row = _.row;
        var cells_read = 0;
        async.whilst(
            function(){ return xi < w; },
            (function read_cell(next_cell){
                _.x = xi;
                ++xi;
                this.__read_one_cell(_, function(err, cell_list){
                    if(err){
                        next_cell(err);
                    } else {
                        if(cell_list){
                            if(_.just_count){
                                cell_list = [cell_list[0].length, cell_list[1]];
                            }
                            row[_.offsetx + _.x] = cell_list;
                            ++cells_read;
                        }
                        next_cell();
                    }
                });
            }).bind(this), function(err){
                if(err){callback(err);}
                else{callback(null, cells_read);}
            }
        );                       
    },
    __read_one_cell : function (_, callback){
        var x       = _.x;
        var cell_ptr= _.cell_pointers[x];
        var minx    = _.box.minx, maxx = _.box.maxx;
        var read_cell_data = _.read_row_data && (minx <= x && x <= maxx);
        if(cell_ptr){
            // # seek to cell location denoted by cell_ptr,
            _.finp.seek(cell_ptr);
            var cell=[null, null];
            async.waterfall([
                function fetch_cell_count(next){
                    _.finp.unpack(">H", 2, next);
                },
                function set_cell_count(upc, next){
                    _.cell_count = upc[0];
                    next();
                },
                function(next){
                    _.finp.unpack(">" + str_repeat(_.rcfmt, _.cell_count), _.rec_bytes * _.cell_count, next);
                },
                function(upc, next){
                    cell[0] = upc;
                    next();
                },
                function(next){
                    if(_.version >= 2){
                        _.finp.unpack(">" + str_repeat('f', _.cell_count), 4 * _.cell_count, next);
                    } else {
                        next(null, null);
                    }
                },
                function(upc, next){
                    cell[1] = upc;
                    next();
                },
                function(next){
                    _.stats.maxAmp = Math.max(_.stats.maxAmp, cell[1] ? Math.max.apply(null, cell[1]) : 0);
                    next();
                },
                function(next){
                    if(read_cell_data){
                        next(null, cell);
                    } else {
                        next();
                    }
                }
            ], callback);
            // # print cell_count, rcfmt, rcbytes
        } else {
            callback();
        }
    },
    
    flatten : function(){
        var recs = {};
        var idx = this.index, row, cell;
        
        for(var y in idx){
            row = idx[y];
            for(var x in row){
                cell = row[x];
                for(var z in cell[0]){
                    recs[cell[0][z]] = true;
                }
            }
        }
        
        return this.recordings.filter(function(r, i){
            return recs[i];
        });
    },
    
    count : function(){
        var recs = {}, count=0;
        var idx = this.index, row, cell;
        
        for(var y in idx){
            row = idx[y];
            for(var x in row){
                cell = row[x];
                for(var z in cell[0]){
                    var rec = cell[0][z];
                    if(!recs[rec]){
                        recs[rec] = true;
                        ++count;
                    }
                }
            }
        }
        
        return count;
    }


};

module.exports = scidx;
