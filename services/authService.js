var msRestAzure = require('ms-rest-azure');

exports.getToken = async function () {
    if (process.env['MSI_ENDPOINT']) {
        // Use MSI
        return msRestAzure.loginWithAppServiceMSI();
    } else {
        // Use Service Principal
        let appId = process.env['appId']; // service principal
        let appSecret = process.env['appSecret'];
        let tennantId = process.env['tenantId']; // tenant id;

        if (appId === undefined || appSecret === undefined || tennantId === undefined) {
            throw new Error('Service Principal undefined in app configuration.');
        } else {
            return msRestAzure.loginWithServicePrincipalSecret(appId, appSecret, tennantId);
        }
    }
};
