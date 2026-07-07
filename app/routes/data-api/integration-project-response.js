function formatCreatedProjectResponse(project, projectId) {
  const body = project && typeof project.toJSON === 'function' ? project.toJSON() : (project || {});
  return Object.assign({}, body, { project_id: projectId, id: projectId });
}

module.exports = {
  formatCreatedProjectResponse
};
