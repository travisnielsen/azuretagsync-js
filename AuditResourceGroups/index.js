var msRestAzure = require('ms-rest-azure');
var ResourceManagementClient = require('azure-arm-resource').ResourceManagementClient;
var tagUtil = require('../AuditResourceGroups/tagUtil');
var appId = process.env['appId']; // service principal
var appSecret = process.env['appSecret'];
var tennantId = process.env['tenantId']; // tenant id;
var resourceClient;
var ctx;

module.exports = function (context) {
    ctx = context;
    var configItems = context.bindings.configTblIn;
    var invalidTypes = context.bindings.invalidTypesTbl;

    if (configItems.length < 1) {
        // TODO: Create defaulf config items
        context.done();
    }

    configItems.forEach(subscriptionConfig => {
        context.log(subscriptionConfig.SubscriptionId);
        var tagList = subscriptionConfig.RequiredTags.split(',');

        msRestAzure.loginWithServicePrincipalSecret(appId, appSecret, tennantId, function (err, credentials) {
            if (err) return console.log(err);
            resourceClient = new ResourceManagementClient(credentials, subscriptionConfig.SubscriptionId);

            processResourceGroups(tagList, invalidTypes, function (result) {
                context.bindings.outputQueueItem = result;
                context.log('DONE');
                context.done();
            });
        });
    });
};

async function processResourceGroups (tagList, invalidTypes, callback) {
    var updatesList = [];
    var resourceGroups = await resourceClient.resourceGroups.list();

    for (let rg of resourceGroups) {
        ctx.log(rg.name);

        var tagsToSync = tagUtil.getRequiredTags(rg.tags, tagList);

        if (Object.keys(tagsToSync).length < 1) {
            ctx.log.warn('Resource Group: ', rg.name, ' does not have required tags');
        } else {
            var resourceItems = await resourceClient.resources.listByResourceGroup(rg.name);

            // TODO: Filter out invalid resources

            for (let resItem of resourceItems) {
                if (resItem.tags !== undefined) {
                    var tagUpdatesRequired = tagUtil.getTagUpdates(resItem.tags, tagsToSync);
                } else {
                    ctx.log.warn('Resource type:', resItem.type, 'does not support tags.', resItem.id);
                }

                if (tagUpdatesRequired) {
                    ctx.log.info('Submitting tag updates for: ', resItem.id);
                    updatesList.push(JSON.stringify(resItem));
                }
            }
        }
    }

    callback(updatesList);
}
