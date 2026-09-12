// Two PG-strictness fixes, both measured live on 2026-09-12 as 500s on
// /legacy-api/project/<slug>/classifications and /models:
//
// 1. Bare boolean literals in comparisons. mysql's driver inlines JS booleans
//    as bare true/false; MySQL accepts tinyint(1) = true; PG rejects
//    smallint = boolean (42883, 'operator does not exist'). The translator now
//    folds =/!=/<> true|false to 1|0 — safe because the only real boolean
//    columns in the PG arbimon DB are in internal ops tables no app SQL
//    touches (verified on the replica 2026-09-12).
//
// 2. The modelList UNION's second branch had m.project_id and m.uri SWAPPED
//    relative to the first branch. MySQL matches UNION columns loosely (and
//    the app reads rows by name), so it was invisible; PG matches positionally
//    and strictly — 'UNION types character varying and bigint cannot be
//    matched'. The branches are now column-order aligned.
//
// NEGATIVE CONTROL: the fold assertions FAIL against the unfixed translator;
// the UNION alignment assertion FAILS against the swapped branch.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const pgshadow = require(path.join(__dirname, '..', 'app', 'utils', 'dbpool-pg.js'));
const translate = pgshadow.translate;
const projectsSrc = fs.readFileSync(path.join(__dirname, '..', 'app', 'model', 'projects.js'), 'utf8');

describe('translate() — boolean-literal fold (smallint = boolean 42883 fix)', function () {
    it('folds `= true` to `= 1`', function () {
        const out = translate('SELECT 1 FROM jobs J WHERE J.completed = true');
        assert.ok(/J\.completed = 1\b/.test(out), 'got: ' + out);
        assert.ok(!/= true\b/i.test(out), 'bare true survived: ' + out);
    });

    it('folds `= false` to `= 0`', function () {
        const out = translate('SELECT 1 FROM jobs J WHERE J.hidden = false');
        assert.ok(/J\.hidden = 0\b/.test(out), 'got: ' + out);
        assert.ok(!/= false\b/i.test(out), 'bare false survived: ' + out);
    });

    it('folds `!= true` and `<> false`', function () {
        assert.ok(/!= 1\b/.test(translate('SELECT 1 FROM jobs J WHERE J.completed != true')));
        assert.ok(/<> 0\b/.test(translate('SELECT 1 FROM jobs J WHERE J.completed <> false')));
    });

    it('folds the exact live failing shape (classifications getFor, completed)', function () {
        const out = translate('SELECT UNIX_TIMESTAMP( J.`date_created` )*1000 as `date`, J.`job_id` FROM `jobs` AS J WHERE (J.`completed` = true) AND (J.`project_id` = ?)');
        assert.ok(!/= true\b/i.test(out), 'bare true survived: ' + out);
        assert.ok(/completed(?:`)? = 1\b/.test(out), 'got: ' + out);
        assert.ok(!/unix_timestamp/i.test(out), 'unix_timestamp survived (fold ordering): ' + out);
    });

    it('does NOT touch "true" inside a string literal (protectLiterals)', function () {
        const out = translate("SELECT * FROM sites WHERE name = 'true'");
        assert.ok(!/= 1\b/.test(out), 'the string literal got folded to a number: ' + out);
        assert.ok(/'true'/.test(out), 'the string literal was not preserved: ' + out);
    });

    it('does NOT touch column identifiers merely CONTAINING true/false', function () {
        const q = 'SELECT J.is_true north FROM jobs J';
        assert.strictEqual(translate(q), q);
    });
});

describe('modelList UNION — branch column order aligned (UNION type-mismatch fix)', function () {
    it('both UNION branches select m.uri BEFORE m.project_id', function () {
        // Extract the two SELECT branches of the modelList UNION from the source.
        const unionIdx = projectsSrc.indexOf(') UNION(');
        assert.ok(unionIdx > 0, 'modelList UNION not found');
        const branch1 = projectsSrc.slice(0, unionIdx);
        const branch2 = projectsSrc.slice(unionIdx);
        const b1uri = branch1.lastIndexOf('m.uri');
        const b1pid = branch1.lastIndexOf('m.project_id');
        const b2uri = branch2.indexOf('m.uri');
        const b2pid = branch2.indexOf('m.project_id');
        assert.ok(b1uri > 0 && b1pid > 0 && b2uri > 0 && b2pid > 0, 'could not locate uri/project_id in both branches');
        assert.ok(b1uri < b1pid, 'branch 1 should select uri before project_id (reference order)');
        assert.ok(b2uri < b2pid,
            'branch 2 selects project_id before uri — the swap PG rejects ' +
            '("UNION types character varying and bigint cannot be matched")');
    });
});
