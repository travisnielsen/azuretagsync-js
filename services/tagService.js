/**
 * Summary. Creates list of mandatory tag names that the resource group has.
 * @param {Object{}} rgTags - List of tag / value pairs associated to the current resource group.
 * @param {string[]} requiredTagsList - Array of mandatory tag names
 * @return {Object{}} - List of mandatory tag keys configured on the resource group.
 */
exports.getRequiredTags = function (rgTags, requiredTagsList) {
    var resultTags = {};
    var rgTagKeys = Object.keys(rgTags);
    rgTagKeys = rgTagKeys.map(k => k.toLocaleLowerCase());
    var intersection = requiredTagsList.filter(value => -1 !== rgTagKeys.indexOf(value.toLowerCase()));

    intersection.forEach(key => {
        resultTags[key] = rgTags[key];
    });

    return resultTags;
};

/**
 * Summary. Updates resouce item tags based on parent resource group
 * Description. Tags provided in the 'resTags' are updated by reference
 * @param {Object[]} resTags - Array of tag / value pairs associated to the current resource.
 * @param {Object[]} rgTags - Array of mandatory tag / value pairs associated to the parent resource group.
 * @return {bool} - Indicates if the resource tags have been updated.
 */
exports.getTagUpdates = function (resTags, rgTags) {
    if (resTags === undefined) {
        // resource does not have any tags. Set to the RG required tags and exit.
        resTags = rgTags;
        return true;
    }

    var resTagKeys = Object.keys(resTags);
    var rgTagKeys = Object.keys(rgTags);
    var tagUpdateRequired = false;

    rgTagKeys.forEach(rgTagKey => {
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
};
