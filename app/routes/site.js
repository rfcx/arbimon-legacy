const express = require('express');
var router = express.Router();
const model = require('../model');

// Opens project url by external id of the site
router.get('/:externalId', async (req, res) => {
  try {
    const site = await model.sites.find({ external_id: req.params.externalId }).get(0)
    const project = await model.projects.find({id: site.project_id}).get(0)
    return res.redirect(`/project/${project.url}/dashboard`)
  }
  catch (e) {
    res.status(404).render('not-found', { user: req.session.user });
  }
});

module.exports = router;
