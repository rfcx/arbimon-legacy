var express = require('express');
var router = express.Router();

// Routes mounted here run BEFORE the session middleware, so they must carry
// their own authentication. Everything below is guarded by
// `verifyToken()` + `hasRole([...])` and is called server-side (rfcx-api ->
// core/_services/arbimon) with no browser session.
//
// The media asset proxy `GET /legacy-api/ingest/recordings/:attr` was moved OUT
// of here on 2026-08-10: it has no guard of its own, so being here made it
// publicly readable (private-project spectrograms + raw audio). It is now in
// `data-api/ingest-assets.js`, mounted behind the login gate in `routes/index.js`.
// Do not add unguarded routes to this file.
router.use('/legacy-api/ingest', require('./data-api/ingest'));
router.use('/legacy-api/integration', require('./data-api/integration'));

module.exports = router;
