// const uuidv4 = require('uuid/v4');

exports.getRequiredTags = function (rgTags, requiredTagsList) {
    var resultTags = {};
    var rgTagKeys = Object.keys(rgTags);
    var intersection = requiredTagsList.filter(value => -1 !== rgTagKeys.indexOf(value));

    intersection.forEach(key => {
        resultTags[key] = rgTags[key];
    });

    return resultTags;
};

exports.getTagUpdates = function (resTags, rgTags) {
    var resTagKeys = Object.keys(resTags);
    var rgTagKeys = Object.keys(rgTags);

    var tagUpdateRequired = false;

    rgTagKeys.forEach(rgTagKey => {
        if (resTags === undefined) {
            // resource does not have any tags. Set to the RG required tags and exit.
            return rgTags;
        }

        if (resTagKeys.includes(rgTagKey)) {
            // resource has matching required RG tag
            if (resTags[rgTagKey] !== rgTags[rgTagKey]) {
                // resource tag value is not the same as the parent RG
                resTags[rgTagKey] = rgTags[rgTagKey];
                tagUpdateRequired = true;
            }
        } else {
            // resource does not have a matching required RG tag
            resTags[rgTagKey] = rgTags[rgTagKey];
            tagUpdateRequired = true;
        }
    });

    return tagUpdateRequired;

    /*
    if (tagUpdateRequired) {
        return resTags;
    } else {
        var emptyList = {}
        return emptyList;
    }
    */
};

/*
class AuditResource {
    constructor (type, location, apiVersion) {
        this.partitionKey = 'init';
        this.rowKey = uuidv4();
        this.type = type;
        this.location = location;
        this.apiVersion = apiVersion;
        this.errorMessage = '';
    }
}
*/
