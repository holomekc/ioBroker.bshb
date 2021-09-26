const path = require("path");
const {tests} = require("@iobroker/testing");

// Run unit tests - See https://github.com/ioBroker/testing for a detailed explanation and further options
tests.unit(path.join(__dirname, ".."), {
    //     ~~~~~~~~~~~~~~~~~~~~~~~~~
    // This should be the adapter's root directory

    // Define your own tests inside defineAdditionalTests.
    // If you need predefined objects etc. here, you need to take care of it yourself
    defineAdditionalTests() {
        it("works", () => {
            // see below how these could look like
        });
    },
});
