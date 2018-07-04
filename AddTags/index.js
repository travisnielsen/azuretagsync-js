var authService = require('../services/authService');
var ResourceManagementClient = require('azure-arm-resource').ResourceManagementClient;
var azure = require('azure-storage');
var connectionString;
var tableService;

module.exports = async function (context, myQueueItem) {
    context.log('AddTags triggered for resource:', myQueueItem.id);
    var subscriptionId = myQueueItem.id.split('/')[2];

    connectionString = process.env['AzureWebJobsStorage'];
    tableService = azure.createTableService(connectionString);

    try {
        var credentials = await authService.getToken();
        var resourceClient = new ResourceManagementClient(credentials, subscriptionId);
    } catch (err) {
        context.log.error('Unable to connect to the ARM API. Message:', err.message);
    }

    try {
        var resource = await resourceClient.resources.getById(myQueueItem.id, myQueueItem.apiVersion);
        resource.tags = myQueueItem.tags;
        delete resource.kind;
        delete resource.primaryLocation;
        delete resource.properties;
        // delete resource.sku;
        // resource.properties = null;
        var result = await resourceClient.resources.updateById(myQueueItem.id, myQueueItem.apiVersion, resource);
        context.log('Updated tags for', result.id);
    } catch (err) {
        context.log.error('Error updating resource. Message:', err.message);
        addErrorMessage(context, myQueueItem, err.message);
    }

    // context.done();
};

async function addErrorMessage (context, updateItem, message) {
    var resourceTableItem = context.bindings.resourceTypesIn.filter(item => item.Type === updateItem.type)[0];
    resourceTableItem.ErrorMessage = message;

    tableService.replaceEntity('ResourceTypes', resourceTableItem, function (error) {
        if (error) {
            context.log.error('Error updating table item. Message:', error.message);
        }
    });
}
