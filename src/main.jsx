import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";   // usa App invece di App
import "./App.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
