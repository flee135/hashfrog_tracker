import "bootstrap/dist/css/bootstrap.min.css";
import ReactDOM from "react-dom/client";

import App from "./App";
import "./index.css";

// Context and Router
import { BrowserRouter } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import { LayoutProvider } from "./context/layoutContext";
import { TrackerProvider } from "./context/trackerContext";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  /* <React.StrictMode>*/
  <ErrorBoundary>
    <LayoutProvider>
      <TrackerProvider>
        <BrowserRouter basename={process.env.PUBLIC_URL}>
          <App />
        </BrowserRouter>
      </TrackerProvider>
    </LayoutProvider>
  </ErrorBoundary>,
  /*</React.StrictMode>*/
);
