import _ from "lodash";

/**
 * Revalidates location availability against current items using a game evaluator.
 * @param {object} locations - Map of region names to location data.
 * @param {object} parsedItems - Parsed items keyed by logic item name.
 * @param {object} evaluator - Active game's logic evaluator with updateItems and isLocationAvailable methods.
 * @param {Set<string>} [skipRegions] - Region names to exclude from traversal.
 * @returns {object} Cloned locations with updated isAvailable flags.
 */
export function validateLocations(locations, parsedItems, evaluator, skipRegions = new Set()) {
  const clonedLocations = _.cloneDeep(locations);

  if (!_.isEmpty(clonedLocations)) {
    evaluator.updateItems(parsedItems, skipRegions);

    _.forEach(_.values(clonedLocations), regionLocations => {
      _.forEach(regionLocations, (locationData, locationName) => {
        _.set(locationData, "isAvailable", evaluator.isLocationAvailable(locationName));
      });
    });
  }

  return clonedLocations;
}
