var azure = require('azure-storage');
let connectionString = process.env['AzureWebJobsStorage'];
var tableService;

exports.initTable = async function (tableName, initialEntity) {
    tableService = azure.createTableService(connectionString);
    tableService.insertEntity(tableName, initialEntity, function (error, result, response) {
        if (!error) {
            // new entity created
        }
    });
}
