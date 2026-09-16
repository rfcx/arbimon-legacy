// templates.js input guards — six raw interpolations of req.query values.
//
// WHAT THIS PINS. app/model/templates.js built SQL by concatenation in six
// places; five interpolated a value straight off req.query (routes/data-api/
// project/templates.js): q, taxon, limit, offset, classIds. Only `project` is
// server-derived. Measured emissions BEFORE the fix:
//
//   ?limit=10          -> LIMIT 10 OFFSET undefined        42703, live
//   ?classIds absent   -> pc.project_class_id = undefined   42703, live (12 of
//                                                           15 records over 7d)
//   ?taxon=1 OR 1=1    -> Stx.taxon_id = 1 OR 1=1
//   ?q=x%' OR '1'='1   -> ... LIKE '%x%' OR '1'='1%' ...    quote break-out
//
// The 42703 was the noisy symptom; the defect is the unparameterised
// interpolation. Note escaping ALONE is not sufficient for the id/pagination
// cases: escape("undefined") yields the literal 'undefined', which PG rejects
// with 22P02 — quieter, still an error, and still user-facing because
// DB_PG_FALLBACK defaults to '0' since the P7 write flip (so a PG error is
// returned to the caller rather than falling back to MariaDB). Hence:
// VALIDATE ids/pagination, ESCAPE the search text.
//
// NEGATIVE CONTROL: every assertion in the "rejects" and "pagination" groups
// fails against the unfixed model (verified by stashing the change).
//
// The helpers are extracted from source rather than require()d: this repo's
// tree cannot be require()d whole on node 26 (a transitive dep,
// buffer-equal-constant-time, breaks on SlowBuffer) — reproduced identically
// on a pristine origin/master checkout, so it is not caused by this change.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql');

const SRC = fs.readFileSync(
    path.join(__dirname, '..', 'app', 'model', 'templates.js'), 'utf8');

function extract(name) {
    const i = SRC.indexOf('function ' + name + '(');
    assert.ok(i >= 0, 'helper not found in templates.js: ' + name);
    let depth = 0, started = false;
    for (let j = i; j < SRC.length; j++) {
        if (SRC[j] === '{') { depth++; started = true; }
        else if (SRC[j] === '}') { depth--; if (started && depth === 0) return SRC.slice(i, j + 1); }
    }
    throw new Error('unbalanced braces for ' + name);
}

const dbpool = { escape: (v) => mysql.escape(v) };
const guards = new Function('dbpool',
    extract('positiveInt') + '\n' + extract('paginationClause') + '\n' +
    extract('likeContains') + '\n' +
    'return { positiveInt, paginationClause, likeContains };')(dbpool);

describe('templates.js — positiveInt', function () {
    it('accepts positive integers, as string or number', function () {
        assert.strictEqual(guards.positiveInt('10'), 10);
        assert.strictEqual(guards.positiveInt(5), 5);
        assert.strictEqual(guards.positiveInt(' 42 '), 42);
    });
    it('rejects the values that actually reached production', function () {
        assert.strictEqual(guards.positiveInt(undefined), null);
        assert.strictEqual(guards.positiveInt('undefined'), null);
        assert.strictEqual(guards.positiveInt(''), null);
    });
    it('rejects injection payloads', function () {
        ['1 OR 1=1', '1; DROP TABLE templates--', '1 UNION SELECT NULL,version()--',
         '1/*x*/', 'abc'].forEach(function (bad) {
            assert.strictEqual(guards.positiveInt(bad), null, 'accepted: ' + bad);
        });
    });
    it('rejects non-positive and non-integral values', function () {
        ['0', '-1', '1.5', '1e3'].forEach(function (bad) {
            assert.strictEqual(guards.positiveInt(bad), null, 'accepted: ' + bad);
        });
    });
    it('rejects non-scalars', function () {
        [null, NaN, {}, [], function () {}].forEach(function (bad) {
            assert.strictEqual(guards.positiveInt(bad), null);
        });
    });
});

describe('templates.js — paginationClause (the live 42703)', function () {
    it('never emits OFFSET undefined when offset is missing', function () {
        const out = guards.paginationClause({ limit: '10' });
        assert.ok(!/undefined/.test(out), 'got: ' + out);
        assert.strictEqual(out, 'LIMIT 10 OFFSET 0');
    });
    it('treats offset=0 as a real offset (the route check is falsy for 0)', function () {
        assert.strictEqual(guards.paginationClause({ limit: '10', offset: '0' }),
                           'LIMIT 10 OFFSET 0');
    });
    it('passes through valid pagination', function () {
        assert.strictEqual(guards.paginationClause({ limit: '10', offset: '20' }),
                           'LIMIT 10 OFFSET 20');
    });
    it('emits nothing when limit is absent or invalid', function () {
        assert.strictEqual(guards.paginationClause({}), '');
        assert.strictEqual(guards.paginationClause({ limit: '1; DROP TABLE x--', offset: '0' }), '');
        assert.strictEqual(guards.paginationClause({ limit: '0' }), '');
    });
    it('emits nothing when offset is hostile', function () {
        assert.strictEqual(guards.paginationClause({ limit: '10', offset: '0 OR 1=1' }), '');
    });
});

describe('templates.js — likeContains (quote break-out)', function () {
    it('keeps a hostile value inside ONE escaped literal', function () {
        const out = guards.likeContains('T.name', "x%' OR '1'='1");
        // strip every quoted literal; no SQL keyword may survive outside them
        const skeleton = out.replace(/'(?:[^'\\]|\\.)*'/g, "''");
        assert.ok(!/\bOR\b/i.test(skeleton), 'injected OR escaped the literal: ' + out);
        assert.ok(/^T\.name LIKE CONCAT\(/.test(out), 'got: ' + out);
    });
    it('keeps a comment terminator inert', function () {
        const out = guards.likeContains('T.name', "x%'--");
        const skeleton = out.replace(/'(?:[^'\\]|\\.)*'/g, "''");
        assert.ok(!/--/.test(skeleton), 'comment escaped the literal: ' + out);
    });
    it('still performs a contains-search for benign input', function () {
        assert.strictEqual(guards.likeContains('T.name', 'owl'),
                           "T.name LIKE CONCAT('%', 'owl', '%')");
    });
    it('handles an apostrophe in a real name', function () {
        const out = guards.likeContains('T.name', "O'Brien");
        assert.ok(/O\\'Brien|O''Brien/.test(out), 'got: ' + out);
    });
});

// The pre-fix expressions, reproduced verbatim, to show WHAT WAS WRONG and to
// give the guards something to be measured against. If a future change reverts
// the model to these shapes, the "source no longer interpolates" test below
// fails — these two describe-blocks are the before/after pair.
describe('templates.js — the PRE-FIX expressions (documented vulnerability)', function () {
    const oldPagination = (o) => o.limit ? ('LIMIT ' + o.limit + ' OFFSET ' + o.offset) : '';
    const oldTaxon      = (o) => 'Stx.taxon_id = ' + o.taxon;
    const oldClass      = (cl) => `pc.project_class_id = ${cl}`;
    const oldQ          = (o) => `(T.name LIKE '%${o.q}%')`;

    it('OLD pagination emitted the live 42703 (OFFSET undefined)', function () {
        assert.strictEqual(oldPagination({ limit: '10' }), 'LIMIT 10 OFFSET undefined');
        // and the guard does not
        assert.strictEqual(guards.paginationClause({ limit: '10' }), 'LIMIT 10 OFFSET 0');
    });
    it('OLD classIds emitted the live 42703 (12 of 15 records)', function () {
        assert.strictEqual(oldClass(undefined), 'pc.project_class_id = undefined');
        assert.strictEqual(guards.positiveInt(undefined), null);   // => filtered out entirely
    });
    it('OLD taxon accepted a tautology; the guard rejects it', function () {
        assert.strictEqual(oldTaxon({ taxon: '1 OR 1=1' }), 'Stx.taxon_id = 1 OR 1=1');
        assert.strictEqual(guards.positiveInt('1 OR 1=1'), null);
    });
    it('OLD q allowed a quote break-out; the guard contains it', function () {
        const evil = "x%' OR '1'='1";
        const before = oldQ({ q: evil }).replace(/'(?:[^'\\]|\\.)*'/g, "''");
        assert.ok(/\bOR\b/i.test(before), 'fixture no longer demonstrates the break-out');
        const after = guards.likeContains('T.name', evil).replace(/'(?:[^'\\]|\\.)*'/g, "''");
        assert.ok(!/\bOR\b/i.test(after), 'guard failed to contain the payload');
    });
});

describe('templates.js — source no longer interpolates req.query values', function () {
    it('has no raw ${options.q} / ${options.taxon} / ${cl} interpolation left', function () {
        [/LIKE '%\$\{options\.q\}%'/, /Stx\.taxon_id = \$\{options\.taxon\}/,
         /Stx\.taxon_id = ' \+ options\.taxon/, /pc\.project_class_id = \$\{cl\}/,
         /'LIMIT ' \+ options\.limit \+ ' OFFSET ' \+ options\.offset/
        ].forEach(function (re) {
            assert.ok(!re.test(SRC), 'raw interpolation still present: ' + re);
        });
    });
    it('drops absent/invalid classIds instead of interpolating them', function () {
        assert.ok(/classIds\s*=\s*classIds\.map\(positiveInt\)/.test(SRC),
            'classIds is not filtered through positiveInt');
    });
});
