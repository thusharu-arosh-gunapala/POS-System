const dbUtils = require('./dbUtils');
const { initialize } = require('./db');

initialize();

async function runTest() {
    try {
        const data = await dbUtils.getDashboardData();
        console.log('Dashboard data:', data);
    } catch (err) {
        console.error('Dashboard test error:', err);
    }
}

runTest();