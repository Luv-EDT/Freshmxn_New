// WHEN WE CHANGE A ONE-ATTEMPT TEST, EVERYONE WHO TOOK THE OLD ONE IS TOLD (owner, Round 31: "the SART
// was amended, so a free update should have been there"). Any change to how a test is shown, timed or
// marked bumps its version here. On start, the server compares these with the versions it last
// announced (utils/versionNotices.js); for a test that moved, each student whose attempt is older is
// offered it again — a notification, an email, a free next update — and the test comes first on their
// assessment page. Their earlier result stays unless they finish the new attempt.
//
// `isCurrent(psychometric)` says whether a student's stored attempt was taken on this version, so a
// student who already took the new one is never offered it. The questionnaires are not here: they
// stay editable until Submit.
const TEST_VERSIONS = {
    sartRaw: {
        version: 2,
        // Round 30: reaction time measured from the frame after the digit is drawn; green on correct presses
        reason: "we now measure reaction time more precisely and show green when you press correctly",
        isCurrent: (psychometric) => Boolean(psychometric && psychometric.sartMeta && psychometric.sartMeta.correctPressFeedback),
    },
    digitSpan: { version: 1, reason: "", isCurrent: () => true },
    wordRecall: { version: 1, reason: "", isCurrent: () => true },
    reasoning: { version: 1, reason: "", isCurrent: () => true },
    storyRecall: { version: 1, reason: "", isCurrent: () => true },
}

// the tests whose version moved since `announced` ({ sartRaw: 1, … }; a missing test counts as 1)
const testsChanged = (announced = {}) => Object.keys(TEST_VERSIONS)
    .filter((module) => TEST_VERSIONS[module].version > ((announced && announced[module]) || 1))

const currentTestVersions = () => Object.fromEntries(Object.entries(TEST_VERSIONS).map(([module, test]) => [module, test.version]))

module.exports = { TEST_VERSIONS, testsChanged, currentTestVersions }
