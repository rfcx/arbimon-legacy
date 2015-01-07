Recordings.findProjectRecordings({
    project_id: 11,
    range: {
        from: new Date(2014,6,01),
        to: new Date(2014,9,01)
    },
    // sites: [''],
    // years: [],
    // months:[11],
    // days:  [],
    // hours: [8],
    limit: 100,
    // offset: 200,
    sortBy: 'site'
},
function(err, rows){
    console.log(rows);
    console.log(err);
});
