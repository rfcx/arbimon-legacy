/**
 * R-DEL (rfcx-local DESIGN-2026-10-23-deleted-project-browse-and-step8-completion.md;
 * operator rulings 2026-10-23 02:06): a SOFT-DELETED project (`projects.deleted_at` set)
 * is visible to SUPER users only, and READ-ONLY for them. Role rows are deliberately KEPT
 * (historical record; restore brings access back) — the rule keys on `deleted_at` alone.
 *
 * WHY THIS EXISTS (measured in prod 2026-10-23): the project gate (`router.param
 * ('projectUrl')`) loaded the project with NO `deleted_at` filter and authorised from the
 * session user's role rows, so the owner of a deleted private project still read its info,
 * 24 sites and 226,412 recordings — and could reach every `manage …` route.
 *
 * WHERE IT RUNS: BEFORE the cached `req.session.user.permissions[project_id]` branch.
 * Legacy sessions live 4 days (session.expiration = 345600 s); a haveAccess-only check
 * would leave a cached member session working for up to 4 days.
 *
 * REAL super = `req.session.user.isSuper === 1`. A masquerading super is presented as the
 * TARGET with isSuper pinned to 0 (login.js), so masquerade cannot open a deleted project
 * unless the target is itself a super — the intended behaviour.
 */

// The ONLY permission a super holds on a deleted project. Exports are not
// permission-gated in this app (they ride router.param), so they stay available
// to supers — operator ruling Q3 "read-only, but download and export allowed".
var READ_ONLY_PERMISSIONS = ['view project'];

// Routes that must keep working on a deleted project for the people who may
// UNDO a delete: the bio-api delete chain's compensation leg calls soft-restore.
var RESTORE_PATH_RE = /\/soft-restore\/?$/;

function isDeleted(project) {
    return !!(project && project.deleted_at);
}

function isRealSuper(req) {
    return !!(req && req.session && req.session.user && req.session.user.isSuper === 1);
}

function isRestorePath(req) {
    var p = (req && (req.path || req.url)) || '';
    return RESTORE_PATH_RE.test(p);
}

/**
 * Decide what the project gate does for this request.
 * @returns {'allow'|'allow-read-only'|'not-found'}
 *   allow            — live project (or a restore call): continue as before
 *   allow-read-only  — deleted project, real super: continue; haveAccess is capped
 *   not-found        — deleted project, anyone else: answer 404 (indistinguishable from unknown)
 */
function gate(req, project) {
    if (!isDeleted(project)) return 'allow';
    if (isRestorePath(req)) return 'allow';
    if (isRealSuper(req)) return 'allow-read-only';
    return 'not-found';
}

/**
 * Cap req.haveAccess for a read-only deleted project: only READ_ONLY_PERMISSIONS pass,
 * for this project id; other projects are unaffected.
 */
function capHaveAccess(req, projectId) {
    var original = req.haveAccess;
    req.projectDeletedReadOnly = true;
    req.haveAccess = function(project_id, permission_name) {
        if (String(project_id) === String(projectId)) {
            return READ_ONLY_PERMISSIONS.indexOf(permission_name) !== -1;
        }
        return original ? original.apply(this, arguments) : false;
    };
}

module.exports = {
    READ_ONLY_PERMISSIONS: READ_ONLY_PERMISSIONS,
    isDeleted: isDeleted,
    isRealSuper: isRealSuper,
    isRestorePath: isRestorePath,
    gate: gate,
    capHaveAccess: capHaveAccess
};