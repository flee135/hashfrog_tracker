import _ from "lodash";
import { useEffect, useMemo, useState } from "react";

import { useChecks, useLocation, useSettingsString } from "../../../context/trackerContext";
import { useLayout } from "../../../context/layoutContext";
import { splitChecksStrings } from "../../checks-string";
import LOCATIONS from "../data/locations.json";
import REGION_SHORT_NAMES from "../data/region-short-names.json";
import { deriveEnabledChecks } from "../logic/checks";
import MMEvaluator from "../logic/evaluator";

// Human name for each check id, for display once locations are keyed by id.
const NAME_BY_ID = {};
for (const regionChecks of Object.values(LOCATIONS)) {
  for (const check of regionChecks) {
    NAME_BY_ID[check.id] = check.name;
  }
}

// Display order follows the key order of region-short-names.json.
const REGION_ORDER = Object.keys(REGION_SHORT_NAMES);

// Builds { region: [id] } for the checks enabled by the two generator strings,
// intersected with the trackable universe (locations.json already drops the
// StartingItems/Fake ids that have no visitable check).
const buildEnabledRegions = settingsString => {
  const [itemListString, junkString] = splitChecksStrings(settingsString, 2);
  const enabled = deriveEnabledChecks(itemListString || "", junkString || "");

  const regions = {};
  for (const [region, regionChecks] of Object.entries(LOCATIONS)) {
    const ids = regionChecks.filter(check => enabled.has(check.id)).map(check => check.id);
    if (ids.length) {
      regions[region] = ids;
    }
  }
  return regions;
};

const Checks = () => {
  const { state: layoutContext } = useLayout();
  const [actions] = useLocation();
  const { locations, items } = useChecks();
  const { settings_string } = useSettingsString();
  const [selectedRegion, setSelectedRegion] = useState(null);

  const [isInitialized, setIsInitialized] = useState(false);
  useEffect(() => {
    if (isInitialized) {
      return;
    }
    // Seed the evaluator so isAvailable is correct as each check is added.
    MMEvaluator.updateItems(items);

    const enabledRegions = buildEnabledRegions(settings_string);
    _.forEach(enabledRegions, (ids, regionName) => {
      ids.forEach(id => actions.addLocation(id, regionName));
    });

    setIsInitialized(true);
  }, [actions, isInitialized, items, settings_string]);

  const counter = useMemo(() => {
    const totals = { checked: 0, available: 0, remaining: 0 };
    _.forEach(locations, regionLocations => {
      _.forEach(regionLocations, location => {
        if (location.isChecked) {
          totals.checked += 1;
        } else {
          totals.remaining += 1;
          if (location.isAvailable) {
            totals.available += 1;
          }
        }
      });
    });
    return totals;
  }, [locations]);

  return (
    <div id="checks" className="check-tracker" style={{ backgroundColor: layoutContext.layoutConfig.backgroundColor }}>
      {selectedRegion ? (
        <RegionChecks
          actions={actions}
          regionLocations={locations[selectedRegion]}
          regionName={selectedRegion}
          setSelectedRegion={setSelectedRegion}
        />
      ) : (
        <RegionList locations={locations} onRegionClicked={setSelectedRegion} />
      )}
      <Info counter={counter} />
    </div>
  );
};

const RegionList = ({ locations, onRegionClicked }) => {
  const regionNames = [
    ...REGION_ORDER.filter(name => locations[name]),
    ...Object.keys(locations).filter(name => !REGION_SHORT_NAMES[name]).sort(),
  ];
  return (
    <div className="check-tracker-locations">
      {regionNames.map(regionName => {
        const regionLocations = locations[regionName];
        const total = _.size(regionLocations);
        const checked = _.filter(_.values(regionLocations), location => location.isChecked).length;
        const available = _.filter(
          _.values(regionLocations),
          location => location.isAvailable && !location.isChecked,
        ).length;
        const remaining = total - checked;

        const style = {};
        if (remaining === 0) {
          style.opacity = "0.75";
        } else if (available === remaining) {
          style.borderLeftColor = "#198754";
        } else if (available > 0) {
          style.borderLeftColor = "#ffc107";
        } else {
          style.borderLeftColor = "#dc3545";
        }

        return (
          <div key={regionName} className="item">
            <button
              type="button"
              className="btn btn-dark btn-sm"
              onClick={() => onRegionClicked(regionName)}
              onContextMenu={e => e.preventDefault()}
              style={style}
            >
              <span>{REGION_SHORT_NAMES[regionName] || regionName}</span>
              <span
                style={{
                  fontSize: "0.7em",
                  display: "block",
                  color: remaining === 0 ? undefined : available === 0 ? "#dc3545" : available === remaining ? "#198754" : "#ffc107",
                  opacity: remaining === 0 ? 0.75 : 1,
                }}
              >
                {available}/{remaining}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
};

const RegionChecks = ({ actions, regionLocations, regionName, setSelectedRegion }) => {
  const checks = _.map(regionLocations, (locationData, id) => {
    const style = {};
    if (!locationData.isAvailable) {
      style.opacity = "0.5";
    }
    if (locationData.isChecked) {
      style.textDecoration = "line-through";
      style.opacity = "0.2";
    }
    const mark = () => actions.markLocation(id, regionName);
    return (
      <li key={id} className="check">
        <button type="button" style={style} onClick={mark} onContextMenu={e => { e.preventDefault(); mark(); }}>
          {NAME_BY_ID[id] || id}
        </button>
      </li>
    );
  });

  return (
    <div className="check-tracker-location">
      <button type="button" className="btn btn-dark btn-sm py-0 mb-2 me-1" onClick={() => setSelectedRegion(null)}>
        Back
      </button>
      <button
        type="button"
        className="btn btn-dark btn-sm py-0 mb-2 me-1"
        onClick={() => actions.toggleRegion(regionName)}
      >
        Toggle All
      </button>
      <ul className="check-list">{checks}</ul>
    </div>
  );
};

const Info = ({ counter }) => {
  return (
    <div className="info">
      <table>
        <tbody>
          <tr>
            <td>{counter.checked}</td>
            <td className="ps-2">Checked</td>
          </tr>
          <tr>
            <td>{counter.available}</td>
            <td className="ps-2">Available</td>
          </tr>
          <tr>
            <td>{counter.remaining}</td>
            <td className="ps-2">Remaining</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default Checks;
