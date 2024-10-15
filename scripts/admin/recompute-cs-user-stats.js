const CitizenScientist = require('../../app/model/citizen-scientist');
const dbpool = require('../../app/utils/dbpool');


async function RecomputeCSUserStats(){
    const list = await dbpool.query(
        "SELECT DISTINCT P.name, Sp.scientific_name, St.songtype,\n" +
        "   PM.project_id, PM.species_id, PM.songtype_id\n" +
        "FROM pattern_matchings PM\n" +
        "JOIN projects P ON P.project_id = PM.project_id\n" +
        "JOIN species Sp ON PM.species_id = Sp.species_id\n" +
        "JOIN songtypes St ON St.songtype_id = PM.songtype_id\n" +
        "WHERE PM.citizen_scientist OR PM.cs_expert"
    );

    const count = list.length;
    let i = 0;
    while(list.length){
        i++;
        const {
            name, scientific_name, songtype, project_id, species_id, songtype_id
        } = list.shift()

        console.log(`${i} of ${count}\t${((i) * 100 / count) | 0}%\t${name}\t${scientific_name}\t${songtype}`);

        await CitizenScientist.computeUserStatsForProjectSpeciesSongtype(project_id, species_id, songtype_id);
    }
}


if (require.main === module){
    RecomputeCSUserStats().then(() => process.exit());
}
