import { Fragment, useCallback, useState } from "react";

import { Link } from "react-router-dom";
import { useLayout } from "../context/layoutContext";
import { getActiveGame } from "../games";
import { readFileAsText } from "../utils/utils";

const LayoutSelector = () => {
  const [key, setKey] = useState(Math.random());
  const { state: layout, dispatch } = useLayout();
  const presets = getActiveGame().data.layouts.presets;

  const handleInputChange = useCallback(
    async event => {
      const {
        target: { files },
      } = event;

      if (files.length > 0) {
        const content = await readFileAsText(files[0]);
        const parsedLayout = JSON.parse(content);
        dispatch({ type: "LAYOUT_UPDATE", payload: parsedLayout });
      } else {
        dispatch({ type: "LAYOUT_DEFAULT" });
      }
    },
    [dispatch],
  );

  const resetLayout = useCallback(() => {
    dispatch({ type: "LAYOUT_DEFAULT" });
    setKey(Math.random());
  }, [dispatch]);

  const applyPreset = useCallback(
    selectedLayout => {
      dispatch({ type: "LAYOUT_UPDATE", payload: selectedLayout });
      setKey(Math.random());
    },
    [dispatch],
  );

  return (
    <div className="w-75">
      <div className="mb-2">
        <label htmlFor="layout-selector" className="form-label">
          Layout JSON File
        </label>
        <input
          key={key}
          className="form-control form-control-sm"
          type="file"
          id="layout-selector"
          onChange={handleInputChange}
          accept=".json"
        />
      </div>
      <div className="mb-2">
        <Link to="/editor" className="btn btn-light btn-sm w-25 me-2">
          Editor
        </Link>
        <button type="button" className="btn btn-light btn-sm w-25" onClick={resetLayout}>
          Reset
        </button>
      </div>
      <p className="m-0 mb-2 note">Current layout: {layout.layoutConfig.name}</p>

      <h5>Layout Presets</h5>
      <ul className="list-unstyled list-horizontal">
        {presets.map((preset, index) => (
          <Fragment key={preset.key}>
            {index > 0 && <li className="list-divider">|</li>}
            <li>
              <button type="button" className="btn btn-link btm-sm p-0" onClick={() => applyPreset(preset.layout)}>
                {preset.label}
              </button>
            </li>
          </Fragment>
        ))}
      </ul>
    </div>
  );
};

export default LayoutSelector;
