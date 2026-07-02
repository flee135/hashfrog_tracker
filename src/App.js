import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";

import Editor from "./scenes/Editor/Editor";
import Layout from "./scenes/Layout";
import TrackerChecks from "./scenes/TrackerChecks";
import TrackerLayout from "./scenes/TrackerLayout";
import Welcome from "./scenes/Welcome";

/**
 * Root application component with route definitions.
 * @returns {object} The rendered routes.
 */
function App() {
  const location = useLocation();

  // Only the launcher (each game's landing) scrolls; tracker/editor windows are
  // fixed-size. useLocation is basename-relative, so both "/" and "/mm" land here.
  useEffect(() => {
    document.body.style.overflow = location.pathname === "/" ? "auto" : "hidden";
  }, [location.pathname]);

  return (
    <div className="App">
      <Routes>
        {/* <Route path="" element={<Navigate to="/tracker" />} /> */}
        <Route path="" element={<Welcome />} />
        <Route path="/tracker" element={<TrackerLayout />} />
        <Route path="/tracker/checks" element={<TrackerChecks />} />
        <Route path="/layout" element={<Layout />} />
        <Route path="/editor" element={<Editor />} />
      </Routes>
    </div>
  );
}

export default App;
