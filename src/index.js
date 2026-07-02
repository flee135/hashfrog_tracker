// Must run before the rest of the app's module graph: resolves the active game
// from the URL and migrates legacy storage.
import "./bootstrap-game";

import "bootstrap/dist/css/bootstrap.min.css";
import ReactDOM from "react-dom/client";

import App from "./App";
import "./index.css";
import reportWebVitals from "./reportWebVitals";

// Context and Router
import { BrowserRouter } from "react-router-dom";
import { LayoutProvider } from "./context/layoutContext";
import { TrackerProvider } from "./context/trackerContext";
import { gameBasename } from "./games";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  /* <React.StrictMode>*/
  <LayoutProvider>
    <TrackerProvider>
      <BrowserRouter basename={gameBasename()}>
        <App />
      </BrowserRouter>
    </TrackerProvider>
  </LayoutProvider>,
  /*</React.StrictMode>*/
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
