/* jshint node:true */
"use strict";

const dbpool = require('../utils/dbpool');

async function loadProjectTieringUsage(connection, projectId) {
    const usageRows = await dbpool.queryWithConn(connection,
        'SELECT \n' +
        '    COALESCE((\n' +
        '        SELECT COUNT(*)\n' +
        '        FROM recordings r\n' +
        '        JOIN sites s ON s.site_id = r.site_id\n' +
        '        WHERE s.project_id = p.project_id AND s.deleted_at IS NULL\n' +
        '    ), 0) AS recording_minutes_count,\n' +
        '    COALESCE((\n' +
        '        SELECT COUNT(*)\n' +
        '        FROM user_project_role upr\n' +
        '        WHERE upr.project_id = p.project_id AND upr.role_id = 3\n' +
        '    ), 0) AS guest_count,\n' +
        '    COALESCE((\n' +
        '        SELECT COUNT(*)\n' +
        '        FROM user_project_role upr\n' +
        '        WHERE upr.project_id = p.project_id AND upr.role_id NOT IN (3, 4)\n' +
        '    ), 0) AS collaborator_count\n' +
        'FROM projects p\n' +
        'WHERE p.project_id = ?',
        [projectId]
    );

    const jobRows = await dbpool.queryWithConn(connection,
        'SELECT \n' +
        '    COALESCE((SELECT COUNT(*) FROM pattern_matchings pm JOIN jobs j ON pm.job_id = j.job_id WHERE j.project_id = ? AND pm.deleted = 0), 0) AS pattern_matching_count,\n' +
        '    COALESCE((SELECT COUNT(*) FROM jobs j WHERE j.project_id = ? AND j.job_type_id IN (6) AND j.hidden = 0), 0) AS job_count', // check only pm for now
        [projectId, projectId]
    );

    const usage = usageRows[0] || {};
    const jobs = jobRows[0] || {};

    return {
        recordingMinutesCount: Number(usage.recording_minutes_count || 0),
        collaboratorCount: Number(usage.collaborator_count || 0),
        guestCount: Number(usage.guest_count || 0),
        patternMatchingCount: Number(jobs.pattern_matching_count || 0),
        jobCount: Number(jobs.job_count || 0)
    };
}

module.exports = {
    getProjectTieringUsage: async function(projectId) {
        const connection = await dbpool.getConnection();
        try {
            return await loadProjectTieringUsage(connection, projectId);
        } finally {
            connection.release();
        }
    }
};
