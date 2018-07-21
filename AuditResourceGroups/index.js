var authService = require('../Services/authService');
var storageService = require('../Services/storageService');
var ResourceManagementClient = require('azure-arm-resource').ResourceManagementClient;
var tagUtil = require('../services/tagService');
const uuidv4 = require('uuid/v4');

var resourceClient;
var ctx;
var resourceTypes;
var newResourceTypes;
var outQueueItems;

module.exports = async function (context, auditTimer) {
    outQueueItems = [];
    newResourceTypes = [];
    context.log('Running:', process.version);
    var configItems = context.bindings.configTblIn;
    ctx = context;
    resourceTypes = context.bindings.resourceTypesIn;
    context.bindings.resourceTypesOut = newResourceTypes;
    var invalidTypes = resourceTypes.filter(item => item.ErrorMessage !== undefined);
    var invalidTypesArr = invalidTypes.map(a => a.Type);

    // SETUP ON FIRST USE
    if (configItems.length < 1) {
        var auditConfigItem = new AuditConfig('list,of,tags,here', 'your_subscription_id_here');
        storageService.initTable('AuditConfig', auditConfigItem);
        context.log('Added default configuration. Please update the AuditConfig table to match your subscription(s)');

        if (resourceTypes.length < 1) {
            storageService.initTable('ResourceTypes', new ResourceType('Microsoft.Storage/storageAccounts', 'East US', '2018-03-01-preview', 'properties'));
            context.log('Configured ResourceTypes table');
        }
        return;
    }

    context.log('Authenticating...');
    var credentials = await authService.getToken(context);

    for (let subscriptionConfig of configItems) {
        context.log(subscriptionConfig.SubscriptionId);
        var tagList = subscriptionConfig.RequiredTags.split(',');
        resourceClient = new ResourceManagementClient(credentials, subscriptionConfig.SubscriptionId);
        var tagUpdates = await processResourceGroups(tagList, invalidTypesArr);
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

        if (!rg.tags) {
            ctx.log.warn('Resource Group: ', rg.name, ' does not have tags');
            continue;
        }

        var tagsToSync = tagUtil.getRequiredTags(rg.tags, tagList);

        if (Object.keys(tagsToSync).length < 1) {
            ctx.log.warn('Resource Group: ', rg.name, ' does not have required tags');
            continue;
        }

        var resourceItems = await resourceClient.resources.listByResourceGroup(rg.name);

        for (let resItem of resourceItems) {
            var tagUpdatesRequired = false;
            if (invalidTypes.indexOf(resItem.type) > -1) {
                ctx.log.warn('Resource type:', resItem.type, 'has known tag issue.', resItem.id);
                tagUpdatesRequired = false;
            } else {
                if (resItem.tags === undefined) {
                    resItem.tags = {};
                }
                tagUpdatesRequired = tagUtil.getTagUpdates(resItem.tags, tagsToSync);
            }

            if (tagUpdatesRequired) {
                var result = await getApiVersion(resItem.type);
                resItem.apiVersion = result.ApiVersion;
                resItem.apiLocation = result.ApiLocation;
                resItem.type = result.Type;
                ctx.log.info('Submitting tag updates for: ', resItem.id);
                updatesList.push(JSON.stringify(resItem));
            }
        }
    }

    return updatesList;
}

async function getApiVersion (type) {
    var namespace = type.split('/')[0];
    var resourceType = type.slice(namespace.length).slice(1);

    var matchingResource = resourceTypes.find(function (item) {
        return item.Type === type;
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
            newResourceTypes.push({ PartitionKey: 'init', RowKey: uuidv4(), Type: type, ApiVersion: apiVersion, ApiLocation: apiLocation });
            resourceTypes.push({ PartitionKey: 'init', RowKey: uuidv4(), Type: type, ApiVersion: apiVersion, ApiLocation: apiLocation });
            return { PartitionKey: 'init', RowKey: uuidv4(), Type: type, ApiVersion: apiVersion, ApiLocation: apiLocation };
        }
    }
}

class ResourceType {
    constructor (type, location, apiVersion, propertyExcludeList) {
        this.PartitionKey = 'init';
        this.RowKey = uuidv4();
        this.Type = type;
        this.ApiLocation = location;
        this.ApiVersion = apiVersion;
        this.PropertyExclude = propertyExcludeList;
    }
}

class AuditConfig {
    constructor (requiredTags, subscriptionId) {
        this.PartitionKey = 'init';
        this.RowKey = uuidv4();
        this.RequiredTags = requiredTags;
        this.SubscriptionId = subscriptionId;
    }
}
