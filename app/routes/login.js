/* jshint node:true */
"use strict";

var debug = require('debug')('arbimon2:route:login');
var express = require('express');
var router = express.Router();
var q = require('q');
var model = require('../model/');
const auth0Service = require('../model/auth0')


const anonymousGuest = {
    id: 0,
    username: 'guest',
    email: '',
    firstname: 'Anonymous',
    lastname: 'Guest',
    isAnonymousGuest: true,
    isSuper: 0,
    isRfcx: 0,
    imageUrl: ''
}

// Resolve the target user for an active, non-expired masquerade IFF the REAL
// (JWT-authenticated) account is a superuser. Returns the target's user row +
// the real super's email, or null if masquerade is not applicable. Never lets
// a non-super, an expired window, or a super-target take effect. Any error is
// swallowed to a null result so a failure can only ever DROP masquerade back
// to the real user, never strand or escalate.
async function resolveMasquerade(session, realUserRow) {
    try {
        const m = session && session.masquerade;
        if (!m || !m.targetUserId) return null;
        if (m.expiresAt && m.expiresAt <= Date.now()) {
            console.log('MASQUERADE ' + JSON.stringify({
                action: 'expired', realEmail: m.realEmail || null,
                targetUserId: m.targetUserId, targetEmail: m.targetEmail || null,
                at: new Date().toISOString()
            }));
            session.masquerade = undefined;
            return null;
        }
        // The REAL account must currently be a superuser.
        if (!realUserRow || realUserRow.is_super !== 1) return null;
        // Never impersonate yourself.
        if (realUserRow.user_id === m.targetUserId) return null;
        // findById resolves to a ROWS ARRAY ([row]) via q.nfcall+.get(0); unwrap.
        const targetRows = await model.users.findById(m.targetUserId);
        const target = Array.isArray(targetRows) ? targetRows[0] : targetRows;
        if (!target || !target.user_id || !target.rfcx_id) return null;
        // Never impersonate another superuser (defense in depth vs the start guard).
        if (target.is_super === 1) return null;
        return { target: target, realEmail: realUserRow.email };
    } catch (e) {
        return null;
    }
}

router.use(function create_user_object(req, res, next) {
    const session = req.session
    const permissions = session.user && session.user.permissions ? session.user.permissions : undefined
    if (!req.user) {
        session.isAnonymousGuest = true;
        session.user = anonymousGuest;
        return next();
    }
    else if (session && req.user && req.user.email) {
        q.ninvoke(model.users, 'findByEmail', req.user.email).get(0).then(async user => {
            if (!user.length) {
                session.isAnonymousGuest = true;
                session.user = anonymousGuest;
                return next();
            }
            const realRow = user[0];
            // -- superuser masquerade swap (Phase 1) --------------------------
            // If the real (super) account has an active masquerade, present the
            // TARGET user as session.user so every downstream check (ACLs,
            // isSuper, project membership) sees exactly what the target sees.
            // The swap keys off the REAL JWT identity every request, so it is
            // self-healing: revoke super / expire window / stop -> back to real.
            const masq = await resolveMasquerade(session, realRow);
            if (masq) {
                session.isAnonymousGuest = false;
                masq.target.picture = req.user.picture
                session.user = model.users.makeUserObject(masq.target, {secure: req.secure, all:true});
                // Target is non-super by guarantee; hard-pin the flag so no
                // stale value can leak elevated access into the masquerade.
                session.user.isSuper = 0;
                session.user.permissions = permissions
                // Marker consumed by the banner/tray + write-audit; presence of
                // this field == "this request is being viewed as someone else".
                session.user.masqueradedBy = masq.realEmail;
                return next();
            }
            session.isAnonymousGuest = false;
            realRow.picture = req.user.picture
            session.user = model.users.makeUserObject(realRow, {secure: req.secure, all:true});
            session.user.permissions = permissions
            return next();
        }).catch(next)
    }
    else {
        return next();
    }
});

router.use(function(req, res, next) {

    req.haveAccess = function(project_id, permission_name) {
        if(req.session.user.isSuper === 1)
            return true;

        var projectPerms = req.session.user.permissions && req.session.user.permissions[project_id];
        if(!projectPerms)
            return false;

        var havePermission = projectPerms.filter(function(perm) {
            return perm.name === permission_name;
        });

        return havePermission.length > 0;
    };

    next();
});

router.get('/legacy-login', (req, res, next) => {
    if (!req.user) {
        console.log('\n\n---TEMP2: auth req.originalUrl', req.originalUrl, req.session.currentPath)
        return res.redirect(auth0Service.universalLoginUrl)
    }
})
router.get('/legacy-login-callback', async function(req, res, next) {
    res.type('html');
    try {
        const query = req.query || {}
        if (query.error) {
            return next(new Error(query.error_description))
        }
        if (!query.code) {
            return next(new Error('Invalid authentication data: query code'))
        }
        const tokens = await auth0Service.getTokensByCode(query.code)
        if (!tokens) {
            return next(new Error('Invalid authentication data: user token'))
        }
        const profile = auth0Service.parseTokens(tokens)
        model.users.sendTouchAPI(tokens.id_token)
        await model.users.auth0Login(req, profile, tokens);
        if (!req.session === undefined && !req.session.currentPath) {
            console.log('\n\n---TEMP: legacy-login-callback session undefined')
            return res.redirect('/projects');
        }
        if (!req.session.currentPath) {
            console.log('\n\n---TEMP: legacy-login-callback session.currentPath', req.session.currentPath)
            return res.redirect('/projects');
        }
        return res.redirect(req.session.currentPath)
    } catch (e) {
        next(e)
    }
});

router.get('/legacy-logout', function(req, res, next) {
    res.type('json');
    req.session.destroy(function(err) {
        if(err) return next(err);
        console.log('\n\n----TEMP: /legacy-logout req.query', req.query)
        if (req.query && req.query.redirect && (req.query.redirect === 'false' || req.query.redirect === false)) { 
            return res.status(200).json({message: 'legacy session destroyed'});
        }
        console.log('\n\n----TEMP: /legacy-logout redirect to logoutUrl')
        return res.redirect(auth0Service.logoutUrl)
    });
});

module.exports = router;
