const runAccessControlTests = require("./accessControl.test");
const runSprint4Tests = require("./sprint4.test");
const runSprint5Tests = require("./sprint5.test");
const runSprint6Tests = require("./sprint6.test");
const runCareTeamManagementTests = require("./careTeamManagement.test");

require("./tokenService.test");
require("./projectArtifacts.test");

(async () => {
    await runAccessControlTests();
    await runSprint4Tests();
    await runSprint5Tests();
    await runSprint6Tests();
    await runCareTeamManagementTests();
    console.log("all tests passed");
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
