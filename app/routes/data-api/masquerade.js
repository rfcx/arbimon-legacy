/* jshint node:true */
"use strict";

/**
 * Superuser masquerade ("view as user") — Phase 1 (legacy app).
 *
 * A superuser can temporarily see Arbimon exactly as a chosen non-super user
 * sees it, to reproduce and triage user-reported issues (e.g. blank ROI grids,
 * missing projects). The masquerade is:
 *
 *   - EXPLICIT: started + stopped from the admin masquerade tray.
 *   - SESSION-SCOPED: state lives ONLY in the Redis-backed express session
 *     (`req.session.masquerade`). NO database schema or row changes.
 *   - REAL-IDENTITY-GATED: every guard here keys off the REAL Auth0 identity
 *     (`req.user.email` from the verified JWT), NEVER off `req.session.user`
 *     (which login.js deliberately overwrites with the target while active).
 *     This is what makes "stop" always reachable even mid-masquerade and what
 *     stops a masqueraded session from starting a nested/again masquerade.
 *   - AUDITED: start/stop emit a structured `MASQUERADE` log line (→ stdout →
 *     Loki), the durable audit trail (no DB table needed).
 *   - BOUNDED: auto-expires after MASQUERADE_TTL_MS even if never stopped.
 *
 * Guardrails:
 *   - only a real superuser may start/stop;
 *   - cannot masquerade as another superuser (no lateral escalation);
 *   - cannot masquerade as yourself or as the anonymous guest;
 *   - target must exist and be a real (rfcx_id-bound) account.
 */

const express = require('express');
const router = express.Router();
const model = require('../../model');

const MASQUERADE_TTL_MS = 60 * 60 * 1000; // 60 minutes

// ---- helpers ---------------------------------------------------------------

// The REAL authenticated identity is the JWT (req.user), NOT session.user.
// login.js sets session.masquerade.realEmail at start; but the definitive
// gate is the live token so a stolen/echoed session can't lie about it.
function realEmail(req) {
    return (req.user && req.user.email) ? req.user.email : null;
}

function auditLog(action, req, extra) {
    // One structured line per masquerade lifecycle event. Kept greppable.
    const m = (req.session && req.session.masquerade) || {};
    const payload = Object.assign({
        action: action,                    // start | stop | denied | expired
        realEmail: realEmail(req) || (m.realEmail || null),
        targetUserId: m.targetUserId || null,
        targetEmail: m.targetEmail || null,
        ip: req.headers['x-forwarded-for'] || req.ip || null,
        at: new Date().toISOString()
    }, extra || {});
    console.log('MASQUERADE ' + JSON.stringify(payload));
}

// Guard: only a REAL superuser (per the JWT-derived session.user BEFORE any
// masquerade swap would have happened is unreliable, so we re-derive from the
// token email against the DB). Cheap: one indexed lookup, only on the small
// masquerade endpoints.
async function requireRealSuper(req, res, next) {
    try {
        const email = realEmail(req);
        if (!email) {
            auditLog('denied', req, { reason: 'no-token' });
            return res.status(401).json({ error: 'not authenticated' });
        }
        const rows = await model.users.findByEmailAsync(email);
        const real = rows && rows[0];
        if (!real || real.is_super !== 1) {
            auditLog('denied', req, { reason: 'not-super', email: email });
            return res.status(403).json({ error: 'forbidden' });
        }
        req.realSuper = real; // { user_id, email, is_super, ... }
        return next();
    } catch (e) {
        return next(e);
    }
}

// CSRF hardening for the mutating endpoints: require a JSON content-type.
// A cross-site <form> POST can only send urlencoded/multipart/text-plain
// without triggering a CORS preflight, so demanding application/json means a
// forged form submission is rejected regardless of cookie SameSite config.
// (The legacy app runs a permissive cors() middleware, so belt-and-braces.)
function requireJson(req, res, next) {
    const ct = (req.headers['content-type'] || '').toLowerCase();
    if (ct.indexOf('application/json') === -1) {
        return res.status(415).json({ error: 'application/json required' });
    }
    next();
}

// ---- routes ----------------------------------------------------------------

// Current masquerade status (safe for any authenticated caller; returns
// inactive for non-supers / no session). Used by the banner + tray to render.
router.get('/status', function(req, res) {
    const m = req.session && req.session.masquerade;
    const active = !!(m && m.targetUserId && (!m.expiresAt || m.expiresAt > Date.now()));
    // realIsSuper: does the REAL account behind this session hold super? Free
    // to answer — create_user_object already rebuilt session.user from the DB
    // this request: not masquerading -> session.user.isSuper is authoritative;
    // masquerading -> the swap only happens for a verified real super, so an
    // active masquerade itself proves it. Client-render hint ONLY — start/stop/
    // search all re-verify server-side via requireRealSuper.
    const realIsSuper = !!(req.session && (
        (req.session.user && req.session.user.isSuper === 1) || active
    ));
    res.json({
        active: active,
        target: active ? {
            id: m.targetUserId,
            email: m.targetEmail,
            name: m.targetName || m.targetEmail
        } : null,
        expiresAt: active ? m.expiresAt : null,
        realIsSuper: realIsSuper
    });
});

// Search candidate users to masquerade as (super-only).
router.get('/search', requireRealSuper, async function(req, res, next) {
    try {
        const q = (req.query.q || '').trim();
        if (q.length < 2) return res.json([]);
        const rows = await model.users.searchForMasquerade(q);
        // Never offer the real super themselves or other supers as start targets;
        // still return them (flagged) so the UI can show WHY they're disabled.
        res.json(rows.map(function(u) {
            return {
                id: u.id,
                email: u.email,
                username: u.username,
                name: [u.firstname, u.lastname].filter(Boolean).join(' ').trim() || u.username,
                isSuper: u.is_super === 1,
                selectable: u.is_super !== 1 && u.id !== req.realSuper.user_id
            };
        }));
    } catch (e) { next(e); }
});

// Start masquerading as a target user (super-only).
router.post('/start', requireJson, requireRealSuper, async function(req, res, next) {
    try {
        const targetUserId = parseInt(req.body && req.body.user_id, 10);
        if (!targetUserId || Number.isNaN(targetUserId)) {
            return res.status(400).json({ error: 'user_id required' });
        }
        if (targetUserId === req.realSuper.user_id) {
            return res.status(400).json({ error: 'cannot masquerade as yourself' });
        }
        // findById resolves to a ROWS ARRAY ([row]) via q.nfcall+.get(0); unwrap.
        const targetRows = await model.users.findById(targetUserId);
        const target = Array.isArray(targetRows) ? targetRows[0] : targetRows;
        if (!target || !target.user_id) {
            return res.status(404).json({ error: 'user not found' });
        }
        if (!target.rfcx_id) {
            return res.status(400).json({ error: 'target is not a real account' });
        }
        if (target.is_super === 1) {
            auditLog('denied', req, { reason: 'target-super', targetUserId: targetUserId });
            return res.status(403).json({ error: 'cannot masquerade as another superuser' });
        }

        const name = [target.firstname, target.lastname].filter(Boolean).join(' ').trim()
            || target.login || target.email;

        // Switching directly from one target to another: audit the implicit
        // stop so the trail shows one contiguous record per target.
        if (req.session.masquerade && req.session.masquerade.targetUserId &&
            req.session.masquerade.targetUserId !== target.user_id) {
            auditLog('stop', req, { reason: 'switch-target' });
        }

        req.session.masquerade = {
            targetUserId: target.user_id,
            targetEmail: target.email,
            targetName: name,
            realUserId: req.realSuper.user_id,
            realEmail: req.realSuper.email,
            startedAt: Date.now(),
            expiresAt: Date.now() + MASQUERADE_TTL_MS
        };
        // Drop any project permissions cached for the REAL user; they'll be
        // re-fetched per-project for the target by the existing route logic.
        if (req.session.user) req.session.user.permissions = undefined;

        auditLog('start', req, {
            targetUserId: target.user_id,
            targetEmail: target.email
        });

        res.json({
            active: true,
            target: { id: target.user_id, email: target.email, name: name },
            expiresAt: req.session.masquerade.expiresAt
        });
    } catch (e) { next(e); }
});

// Stop masquerading. Reachable EVEN while masquerading because the guard uses
// the real JWT identity, not session.user.
router.post('/stop', requireJson, requireRealSuper, function(req, res) {
    if (req.session && req.session.masquerade) {
        auditLog('stop', req, {});
        req.session.masquerade = undefined;
    }
    if (req.session && req.session.user) req.session.user.permissions = undefined;
    res.json({ active: false });
});

module.exports = router;
