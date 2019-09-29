const path = require("path");
const {tests} = require("@iobroker/testing");

// Run integration tests - See https://github.com/ioBroker/testing for a detailed explanation and further options
tests.integration(path.join(__dirname, ".."), {
    allowedExitCodes: [0], // TODO: Not sure yet how to configure adapter. Which was working fine in unit test
    waitBeforeStartupSuccess: 20000
});
