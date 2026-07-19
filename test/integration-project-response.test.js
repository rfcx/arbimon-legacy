var expect = require('chai').expect;
var formatCreatedProjectResponse = require('../app/routes/data-api/integration-project-response').formatCreatedProjectResponse;

describe('integration project create response', function () {
  it('returns project_id and id when the model row is empty', function () {
    expect(formatCreatedProjectResponse(null, 9876)).to.deep.equal({
      project_id: 9876,
      id: 9876
    });
  });

  it('preserves project fields while normalizing id fields', function () {
    var response = formatCreatedProjectResponse({
      project_id: 1,
      id: 1,
      name: 'AMCEL',
      url: 'amcel'
    }, 9876);

    expect(response).to.include({
      project_id: 9876,
      id: 9876,
      name: 'AMCEL',
      url: 'amcel'
    });
  });

  it('supports model objects with toJSON', function () {
    var response = formatCreatedProjectResponse({
      toJSON: function () {
        return { name: 'Test Project', url: 'test-project' };
      }
    }, 1234);

    expect(response).to.deep.equal({
      name: 'Test Project',
      url: 'test-project',
      project_id: 1234,
      id: 1234
    });
  });
});
