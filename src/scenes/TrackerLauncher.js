import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Card from "react-bootstrap/Card";
import Dropdown from "react-bootstrap/Dropdown";
import DropdownButton from "react-bootstrap/DropdownButton";
import Form from "react-bootstrap/Form";
import InputGroup from "react-bootstrap/InputGroup";
import LayoutSelector from "../components/LayoutSelector";
import { useLayout } from "../context/layoutContext";
import { getStartingItemsCache, loadSession, setStartingItemsCache, useSettingsString } from "../context/trackerContext";
import { gameKey, gameUrl, getActiveGame } from "../games";
import { joinChecksStrings, splitChecksStrings } from "../games/checks-string";
import useDebounce from "../hooks/useDebounce";

const GENERATOR_VERSION = process.env.REACT_APP_GENERATOR_VERSION;

const PRESETS = getActiveGame().data.settingPresets;
const CURRENT_ACTIVE_VERSION = getActiveGame().data.currentActiveVersion;
const GENERATOR_VERSIONS = getActiveGame().data.supportedVersions;
// Which generator string(s) drive check tracking, and the launcher notes. A
// single-field game (OoT) packs to settings_string unchanged; multi-field games
// (MM) pack their values into that one slot (see games/checks-string.js).
const CHECKS_STRING_FIELDS = getActiveGame().data.checksStringFields;
const CHECKS_NOTES = getActiveGame().data.checksNotes || [];
// Optional always-visible field (MM only): the seed's starting-items string,
// decoded to pre-mark starting items whether or not check tracking is enabled.
const STARTING_ITEMS_FIELD = getActiveGame().data.startingItemsField;

const TrackerLauncher = () => {
  const [checks, setChecks] = useState(false);
  const { state: layout } = useLayout();

  const layoutSize = useMemo(() => {
    const {
      layoutConfig: { width, height },
    } = layout;

    // Default padding to layouts
    let widthPadding = 0;
    let heightPadding = 25;
    if (checks) {
      widthPadding = 285;
      heightPadding = 25;
    }

    return {
      width: width + widthPadding,
      height: height + heightPadding,
    };
  }, [checks, layout]);

  const {
    setString: setSettingsStringCache,
    settings_string: cachedSettingsString,
    setVersion: setGeneratorVersionCache,
    generator_version: cachedGeneratorVersion,
  } = useSettingsString();

  const [fieldValues, setFieldValues] = useState(
    () => splitChecksStrings(cachedSettingsString || "", CHECKS_STRING_FIELDS.length)
  );
  const settingsString = useMemo(() => joinChecksStrings(fieldValues), [fieldValues]);
  const debouncedString = useDebounce(settingsString, 300);

  const setFieldValue = (index, value) =>
    setFieldValues(prev => prev.map((current, i) => (i === index ? value : current)));

  useEffect(() => {
    setSettingsStringCache(checks ? debouncedString : "");
  }, [checks, debouncedString, setSettingsStringCache]);

  // Starting-items string persists regardless of the checks toggle.
  const [startingItemsString, setStartingItemsString] = useState(getStartingItemsCache);
  const debouncedStartingItems = useDebounce(startingItemsString, 300);
  useEffect(() => {
    setStartingItemsCache(debouncedStartingItems);
  }, [debouncedStartingItems]);

  const [generatorVersion, setGeneratorVersion] = useState(
    () => cachedGeneratorVersion || CURRENT_ACTIVE_VERSION
  );
  const [isCustomVersion, setIsCustomVersion] = useState(
    () => {
      const version = cachedGeneratorVersion || CURRENT_ACTIVE_VERSION;
      return version && !GENERATOR_VERSIONS.includes(version);
    }
  );
  const debouncedVersion = useDebounce(generatorVersion, 300);

  // Auto-detect if version is custom when it changes
  useEffect(() => {
    if (generatorVersion) {
      setIsCustomVersion(!GENERATOR_VERSIONS.includes(generatorVersion));
    }
  }, [generatorVersion]);

  useEffect(() => {
    setGeneratorVersionCache(debouncedVersion);
  }, [debouncedVersion, setGeneratorVersionCache]);

  const launchTracker = useCallback(() => {
    let url = gameUrl("/tracker");
    if (checks) { url = gameUrl("/tracker/checks"); }

    // Launch with exactly what the launcher currently displays, in case a
    // prior resumeSession overwrote the cached config in localStorage.
    localStorage.setItem(gameKey("layout"), JSON.stringify(layout));
    localStorage.setItem(gameKey("settings_string"), checks ? settingsString : "");
    localStorage.setItem(gameKey("starting_items"), startingItemsString);
    localStorage.setItem(gameKey("generator_version"), generatorVersion);

    const { width, height } = layoutSize;

    window.open(
      url,
      "HashFrog Tracker",
      `toolbar=0,location=0,status=0,menubar=0,scrollbars=0,resizable=0,width=${width},height=${height}`
    );
  }, [checks, layout, settingsString, startingItemsString, generatorVersion, layoutSize]);

  // Track whether a saved session exists so the Resume button reacts when one
  // is created in a popup window; refresh on focus when returning to the launcher.
  const [savedSession, setSavedSession] = useState(loadSession);
  useEffect(() => {
    const refresh = () => setSavedSession(loadSession());
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  const resumeSession = useCallback(() => {
    // Re-read fresh: another window may have saved a newer session since the
    // launcher last rendered, leaving the render-time `savedSession` stale.
    const session = loadSession();
    if (!session) { return; }

    // Force the resumed window to reproduce the saved session's config.
    localStorage.setItem(gameKey("layout"), session.layout);
    localStorage.setItem(gameKey("settings_string"), session.settings_string);
    localStorage.setItem(gameKey("starting_items"), session.starting_items || "");
    localStorage.setItem(gameKey("generator_version"), session.generator_version);

    const resumeChecks = !!session.checksEnabled;
    let url = resumeChecks ? gameUrl("/tracker/checks") : gameUrl("/tracker");
    url += "?resume=1";

    const {
      layoutConfig: { width, height },
    } = JSON.parse(session.layout);
    const windowWidth = width + (resumeChecks ? 285 : 0);
    const windowHeight = height + 25;

    window.open(
      url,
      "HashFrog Tracker",
      `toolbar=0,location=0,status=0,menubar=0,scrollbars=0,resizable=0,width=${windowWidth},height=${windowHeight}`
    );
  }, []);

  const updateString = (preset) => {

    // Presets exist only for single-field games; they populate the first field.
    setFieldValue(0, preset.settingsString || "UNKNOWN_SETTINGS_STRING");

    // Use the mapped generator version. If not, use .env, if not, use the current active hardcoded version. (9.0.0 as of 1/25/2026)
    if (preset.generatorVersion) {
      setGeneratorVersion(preset.generatorVersion);
    } else if (GENERATOR_VERSION) {
      setGeneratorVersion(GENERATOR_VERSION);
    } else {
      setGeneratorVersion(CURRENT_ACTIVE_VERSION);
    }
  };

  // Check if current settings match any preset
  const activePreset = useMemo(() => {
    return PRESETS.find(
      (preset) => preset.settingsString === settingsString
    );
  }, [settingsString]);

  return (
    <Fragment>
      {/* Main Launcher Card */}
      <Card className="bg-dark border-secondary text-white mb-4">
        <Card.Body>
          <h5
            className="card-title text-uppercase fw-bold text-white mb-4"
            style={{ letterSpacing: "0.05em" }}
          >
            Tracker Settings
          </h5>

          <div className="d-grid mb-3">
            <Button
              type="button"
              variant="success"
              size="lg"
              onClick={launchTracker}
              className="fw-semibold"
            >
              🚀 Launch New Tracker
            </Button>
          </div>

          <div className="d-grid mb-4">
            <Button
              type="button"
              variant="outline-light"
              onClick={resumeSession}
              disabled={!savedSession}
            >
              ↻ Resume Session
            </Button>
          </div>

          {STARTING_ITEMS_FIELD && (
            <div className="mb-3">
              <Form.Label htmlFor="starting_items" className="text-secondary">
                {STARTING_ITEMS_FIELD.label}
              </Form.Label>
              <InputGroup size="sm">
                <Form.Control
                  type="text"
                  id="starting_items"
                  name="starting_items"
                  placeholder={STARTING_ITEMS_FIELD.placeholder}
                  value={startingItemsString}
                  onChange={({ target: { value } }) => setStartingItemsString(value)}
                />
              </InputGroup>
            </div>
          )}

          <Form.Check
            type="switch"
            id="checks"
            label="Enable check tracking"
            checked={checks}
            onChange={() => setChecks((prev) => !prev)}
            className="mb-3 text-light"
          />

          {checks && (
            <div className="border-top border-secondary pt-3 mt-3">
              <p className="small text-secondary mb-2">
                Configure logic settings for check tracking
              </p>
              {activePreset ? (
                <p className="mb-3">
                  <span className="badge bg-success d-inline-flex align-items-center gap-1">
                    ⭐ Using {activePreset.label} Preset
                  </span>
                </p>
              ) : settingsString && (
                <p className="mb-3">
                  <span className="badge bg-warning text-dark d-inline-flex align-items-center gap-1">
                    ⚙️ Using Custom Settings String
                  </span>
                </p>
              )}

              <div className="row g-3 mb-3">
                <div className="col-4">
                  <Form.Label
                    htmlFor="generator_version"
                    className="text-secondary"
                  >
                    Generator Version
                  </Form.Label>
                  {isCustomVersion ? (
                    <InputGroup size="sm">
                      <Form.Control
                        type="text"
                        id="generator_version"
                        name="generator_version"
                        placeholder="Enter custom version"
                        value={generatorVersion}
                        onChange={({ target: { value } }) =>
                          setGeneratorVersion(value)
                        }
                      />
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={() => {
                          setIsCustomVersion(false);
                          setGeneratorVersion(CURRENT_ACTIVE_VERSION);
                        }}
                      >
                        ×
                      </Button>
                    </InputGroup>
                  ) : (
                    <Form.Select
                      size="sm"
                      id="generator_version"
                      name="generator_version"
                      value={generatorVersion}
                      onChange={({ target: { value } }) => {
                        if (value === "__other__") {
                          setIsCustomVersion(true);
                          setGeneratorVersion("");
                        } else {
                          setGeneratorVersion(value);
                        }
                      }}
                    >
                      <option value="">Select version</option>
                      {GENERATOR_VERSIONS.map((version) => (
                        <option key={version} value={version}>
                          {version}
                        </option>
                      ))}
                      <option value="__other__">Other...</option>
                    </Form.Select>
                  )}
                </div>
                <div className="col-8 d-flex flex-column gap-2">
                  {CHECKS_STRING_FIELDS.map((field, index) => (
                    <div key={field.key}>
                      <Form.Label htmlFor={`checks_string_${field.key}`} className="text-secondary">
                        {field.label}
                      </Form.Label>
                      <InputGroup size="sm">
                        <Form.Control
                          type="text"
                          id={`checks_string_${field.key}`}
                          name={`checks_string_${field.key}`}
                          placeholder={field.placeholder}
                          value={fieldValues[index]}
                          onChange={({ target: { value } }) => setFieldValue(index, value)}
                        />
                      </InputGroup>
                    </div>
                  ))}
                </div>
              </div>

              <div className="d-flex align-items-center gap-2 flex-wrap">
                <Form.Label className="text-secondary mb-0 small">
                  Quick Presets:
                </Form.Label>
                <DropdownButton
                  id="presets-dropdown"
                  title="Select Preset"
                  variant="outline-light"
                  size="sm"
                >
                  {PRESETS.map((preset) => (
                    <Dropdown.Item
                      key={preset.value}
                      onClick={() => updateString(preset)}
                    >
                      {preset.label}
                    </Dropdown.Item>
                  ))}
                </DropdownButton>
              </div>

              <Alert variant="info" className="mt-3 mb-0 py-2 small">
                {" "}To use a different version, select &ldquo;Other...&rdquo; in the Generator Version field and enter a version
                (e.g., <code>7.1.0</code> for releases or <code>dev_9.0.1</code> or <code>devrreal_9.0.2-15</code> for dev branches).
              </Alert>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Layout Configuration Card */}
      <Card className="bg-dark border-secondary text-white mb-4">
        <Card.Body>
          <h5
            className="card-title text-uppercase fw-bold text-white mb-3"
            style={{ letterSpacing: "0.05em" }}
          >
            Layout Configuration
          </h5>
          <LayoutSelector />
        </Card.Body>
      </Card>

      {/* Notes Card */}
      <Card className="bg-dark border-secondary text-white">
        <Card.Body>
          <h6
            className="text-uppercase fw-bold text-white mb-3"
            style={{ letterSpacing: "0.05em" }}
          >
            Notes
          </h6>
          <p className="small text-warning mb-2">
            * Check tracking requires a compatible layout configuration.
          </p>
          <ul className="small text-secondary mb-0 ps-3">
            {CHECKS_NOTES.map((note, index) => (
              <li key={index} className={index < CHECKS_NOTES.length - 1 ? "mb-1" : undefined}>
                {note}
              </li>
            ))}
          </ul>
        </Card.Body>
      </Card>
    </Fragment>
  );
};

export default TrackerLauncher;
