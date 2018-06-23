const msRestAzure = require('ms-rest-azure');

// let msiEnabled = process.env['MSI_ENDPOINT'];
var appId = process.env['appId']; // service principal
var appSecret= process.env['appSecret'];
var tennantId = process.env['tenantId']; // tenant id

exports.getAccessToken = function(callback) {

    if (appId !== null) {
        msRestAzure.loginWithServicePrincipalSecretWithAuthResponse(appId, appSecret, tennantId).then((authres) => {
            authres.credentials.getToken(function(err, result) {
                 // callback(result.accessToken);
                 callback( new ResourceManagementClient  )
            });
        });
    } else {
        msRestAzure.loginWithAppServiceMSI(function(err, credentials) {
            credentials.getToken(function (err, result) {
                callback(result.accessToken);
            });

        });
    }
};