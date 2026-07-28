#!/usr/bin/env node
// g6-fuzz.js — fuzz g6HalfEven against C printf %.6g via python3.
//
// WHY: canonValue's float canonicalization claims C %.6g half-even fidelity
// (MariaDB's client-text renderer). This harness proves it on N random
// float32 values rather than trusting the 10 live pairs in the selftest.
//
// USAGE: node app/utils/g6-fuzz.js [N]      (default 20000; needs python3)
//
// LESSON BAKED IN: the first version of this harness reported 196 false
// mismatches from its own trailing-zero normalization bug
// (replace(/\.?0+$/,'') turns '28000' into '28'). Comparison is therefore
// numeric (parseFloat both sides), never string-normalized.
var child = require('child_process');
var N = parseInt(process.argv[2] || '20000', 10);

var m = require('./dbpool-pg.js');

var py = "import random, struct\n" +
  "random.seed()\n" +
  "for _ in range(" + N + "):\n" +
  "    v = random.uniform(-100000, 100000)\n" +
  "    v32 = struct.unpack('f', struct.pack('f', v))[0]\n" +
  "    print('%r\\t%s' % (v32, '%.6g' % v32))\n";

var out = child.execFileSync('python3', ['-c', py], { maxBuffer: 64 * 1024 * 1024 })
    .toString().trim().split('\n');

var mismatch = 0, shown = 0;
out.forEach(function (line) {
    var parts = line.split('\t');
    var v = parseFloat(parts[0]);
    var expected = parts[1];
    var got = m.g6HalfEven(v);
    // numeric comparison: both renderings parse to the same 6-sig-digit value
    if (parseFloat(got) !== parseFloat(expected)) {
        mismatch++;
        if (shown++ < 10) {
            console.log('MISMATCH v=' + parts[0] + '  c=' + expected + '  js=' + got);
        }
    }
});
console.log(N + ' random float32s vs C printf %.6g: ' + mismatch + ' mismatches');
process.exit(mismatch ? 1 : 0);