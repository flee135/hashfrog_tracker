import "bootstrap/dist/css/bootstrap.min.css";
import ReactDOM from "react-dom/client";

import App from "./App";
import "./index.css";

// Context and Router
import { BrowserRouter } from "react-router-dom";
import { LayoutProvider } from "./context/layoutContext";
import { TrackerProvider } from "./context/trackerContext";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  /* <React.StrictMode>*/
  <LayoutProvider>
    <TrackerProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </TrackerProvider>
  </LayoutProvider>,
  /*</React.StrictMode>*/
);
