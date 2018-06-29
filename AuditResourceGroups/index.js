var msRestAzure = require('ms-rest-azure');
var ResourceManagementClient = require('azure-arm-resource').ResourceManagementClient;
var tagUtil = require('../AuditResourceGroups/tagUtil');
const uuidv4 = require('uuid/v4');

var appId = process.env['appId']; // service principal
var appSecret = process.env['appSecret'];
var tennantId = process.env['tenantId']; // tenant id;
var resourceClient;
var ctx;
var resourceTypes;
var newResourceTypes = [];
var outQueueItems = [];

module.exports = async function (context) {
    var configItems = context.bindings.configTblIn;
    ctx = context;
    resourceTypes = context.bindings.resourceTypesIn;
    context.bindings.resourceTypesOut = newResourceTypes;
    var invalidTypes = resourceTypes.filter(item => item.ErrorMessage !== undefined);

    if (configItems.length < 1) {
        // TODO: Create defaulf config items
        context.done();
        return;
    }

    var credentials = await msRestAzure.loginWithServicePrincipalSecret(appId, appSecret, tennantId);

    for (let subscriptionConfig of configItems) {
        context.log(subscriptionConfig.SubscriptionId);
        var tagList = subscriptionConfig.RequiredTags.split(',');
        resourceClient = new ResourceManagementClient(credentials, subscriptionConfig.SubscriptionId);
        var tagUpdates = await processResourceGroups(tagList, invalidTypes);
        outQueueItems.push.apply(outQueueItems, tagUpdates);
    }

    context.bindings.outputQueue = outQueueItems;
    context.done();
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

            for (let resItem of resourceItems) {
                if (resItem.tags === undefined) {
                    ctx.log.warn('Resource type:', resItem.type, 'does not support tags.', resItem.id);
                } else if (invalidTypes.indexOf(resItem.type) > -1) {
                    ctx.log.warn('Resource type:', resItem.type, 'has known tag issue.', resItem.id);
                } else {
                    var tagUpdatesRequired = tagUtil.getTagUpdates(resItem.tags, tagsToSync);
                }

                if (tagUpdatesRequired) {
                    var result = await getApiVersion(resItem.type);
                    ctx.log(result);
                    resItem.apiVersion = result.ApiVersion;
                    resItem.apiLocation = result.ApiLocation;
                    ctx.log.info('Submitting tag updates for: ', resItem.id);
                    updatesList.push(JSON.stringify(resItem));
                }
            }
        }
    }

    return updatesList;
}

async function getApiVersion (type) {
    var namespace = type.split('/')[0];
    var resourceType = type.slice(namespace.length).slice(1);

    var matchingResource = resourceTypes.find(function (item) {
        return item.Type === resourceType;
    });

    if (matchingResource) {
        return matchingResource;
    } else {
        var provider = await resourceClient.providers.get(namespace);

        var matchingProvider = provider.resourceTypes.find(function (item) {
            return item.resourceType === resourceType;
        });

        if (matchingProvider) {
            var apiVersion = matchingProvider.apiVersions[0];
            var apiLocation = matchingProvider.locations[0];
            newResourceTypes.push({ PartitionKey: 'init', RowKey: uuidv4(), Namespace: namespace, Type: resourceType, ApiVersion: apiVersion, ApiLocation: apiLocation });
            resourceTypes.push({ PartitionKey: 'init', RowKey: uuidv4(), Namespace: namespace, Type: resourceType, ApiVersion: apiVersion, ApiLocation: apiLocation });
            return { PartitionKey: 'init', RowKey: uuidv4(), Namespace: namespace, Type: resourceType, ApiVersion: apiVersion, ApiLocation: apiLocation };
        }
    }
}
