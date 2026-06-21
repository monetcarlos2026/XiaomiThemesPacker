import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { installDevApi } from "./devApi";
import "./styles.css";

installDevApi();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
