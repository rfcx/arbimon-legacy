// templates.js -- public templates roll up to FAMILY-LEVEL classes (rfcx-local 2026-10-04).
//
// WHAT THIS PINS. A class on a family-level catalogue row (scientific_name ==
// its own family's name, e.g. `Cicadidae`) must be offered the public originals
// of the other species in that family, while every exact-species class keeps
// the SQL it had before. Measured on the PG standby before shipping: exact-path
// ids identical master vs branch on 5 controls (11/11), family lookup ~0.25 ms
// and empty for them, Cicadidae synthetic class -> 2 templates (master: 0).
//
// NEGATIVE CONTROL: the "family" group fails on origin/master (no
// familyRollupTemplates, no class_id) -- verified before commit.
//
// Same extraction pattern as templates-input-guards.test.js: the tree cannot
// be require()d whole on node 26.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'app', 'model', 'templates.js'), 'utf8');

function block(start) {
    let depth = 0, started = false;
    for (let j = start; j < SRC.length; j++) {
        if (SRC[j] === '{') { depth++; started = true; }
        else if (SRC[j] === '}') { depth--; if (started && depth === 0) return SRC.slice(start, j + 1); }
    }
    throw new Error('unbalanced braces');
}
function method(name) {
    const i = SRC.indexOf(name + ': async function');
    assert.ok(i >= 0, 'method not found in templates.js: ' + name);
    return block(SRC.indexOf('async function', i)).replace(/^async function/, 'async function ' + name);
}

function load(familyLookupRows, exactRows) {
    const calls = [];
    const dbpool = {
        query: function (q) {
            calls.push(q);
            if (/FROM project_classes pc JOIN species PCS/.test(q)) { return Promise.resolve(familyLookupRows); }
            if (/TS\.family_id = /.test(q)) {
                return Promise.resolve([{ id: 900, species: 48598, songtype: 1, class_id: 777, x1: 0, x2: 1, y1: 0, y2: 1, storedUri: null }]);
            }
            return Promise.resolve(exactRows.map(function (r) { return Object.assign({}, r); }));
        }
    };
    const posInt = block(SRC.indexOf('function positiveInt('));
    const fn = new Function('dbpool', 'roiSpectrogramUrl', 'arbimon2AssetUrl',
        posInt + '\n' + method('familyRollupTemplates') + '\n' + method('getTemplatesByClass') +
        '\nconst Templates = { familyRollupTemplates };\nreturn getTemplatesByClass;')(dbpool, function () { return null; }, function (x) { return x; });
    return { fn: fn, calls: calls };
}

describe('templates.js -- family roll-up of public templates', function () {
    it('exact-species classes: one family lookup, no family query, class_id on every row', async function () {
        const t = load([], [{ id: 1, species: 18, songtype: 1, class_id: 7898, x1: 0, x2: 1, y1: 0, y2: 1 }]);
        const rows = await t.fn(['7898']);
        assert.strictEqual(t.calls.filter(function (q) { return /TS\.family_id = /.test(q); }).length, 0);
        assert.ok(/pc\.species_id = T\.species_id/.test(t.calls[t.calls.length - 1]), 'exact join kept');
        assert.ok(/pc\.project_class_id as class_id/.test(t.calls[t.calls.length - 1]), 'class_id selected');
        assert.deepStrictEqual(rows.map(function (r) { return r.id; }), [1]);
    });

    it('family-level class: rolled-up templates appended, tagged with the class id', async function () {
        const t = load([{ class_id: 777, family_id: 515, songtype_id: 1 }], []);
        const rows = await t.fn(['777']);
        const famQ = t.calls.filter(function (q) { return /TS\.family_id = 515/.test(q); });
        assert.strictEqual(famQ.length, 1);
        assert.ok(/T\.songtype_id = 1/.test(famQ[0]));
        assert.ok(/P\.public_templates_enabled = 1/.test(famQ[0]) && /T\.source_project_id IS NULL/.test(famQ[0]) &&
            /T\.deleted = 0 AND T\.disabled = 0/.test(famQ[0]), 'same visibility rules as the exact path');
        assert.deepStrictEqual(rows.map(function (r) { return [r.id, r.class_id]; }), [[900, 777]]);
        assert.ok(/TS\.`scientific_name` as `species_name`/.test(famQ[0]), 'rolled-up rows name their real species');
    });

    it('no duplicate when a template is returned by both paths for the same class', async function () {
        const t = load([{ class_id: 777, family_id: 515, songtype_id: 1 }],
            [{ id: 900, species: 48749, songtype: 1, class_id: 777, x1: 0, x2: 1, y1: 0, y2: 1 }]);
        const rows = await t.fn(['777']);
        assert.strictEqual(rows.filter(function (r) { return r.id === 900; }).length, 1);
    });

    it('family lookup ids are validated integers, never caller text', async function () {
        const t = load([], []);
        await t.fn(['12', '1 OR 1=1', 'x', '13']);
        assert.ok(/IN \(12,13\)/.test(t.calls[0]), t.calls[0]);
    });

    it('a family lookup row with a non-integer field is skipped, not interpolated', async function () {
        const t = load([{ class_id: 777, family_id: '515; DROP', songtype_id: 1 }], []);
        await t.fn(['777']);
        assert.strictEqual(t.calls.filter(function (q) { return /TS\.family_id/.test(q); }).length, 0);
    });
});