// [A1] isolated: does the OLD `new Promise(async ...)` shape escape the
// caller's try/catch and kill the process? Exit code is the verdict.
//   exit 42 = caller CAUGHT it (would be safe)
//   exit 1  = process died on an unhandled rejection (pod kill) -> expected OLD
function oldGetJobUrl(job, pmData) {
  return new Promise(async function (resolve) {
    job.url = `patternmatching/${pmData.deleted ? '' : ''}`;
    resolve(job);
  });
}
(async () => {
  try {
    await oldGetJobUrl({ job_type_id: 6 }, undefined);
  } catch (e) {
    console.log('CAUGHT_BY_CALLER');
    process.exit(42);
  }
  console.log('NO_THROW_OBSERVED');
  process.exit(43);
})();