const express = require('express');
var router = express.Router();
const model = require('../model');

router.get('/sites/:id', async (req, res) => {
  try {
    const site = await model.sites.find({ external_id: req.params.id }).get(0)
    const project = await model.projects.find({id: site.project_id}).get(0)
    return res.redirect(`/project/${project.url}/dashboard`)
  }
  catch (e) {
    res.status(404).render('not-found');
  }
});

module.exports = router;
