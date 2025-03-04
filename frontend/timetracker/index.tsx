import React from "react";
import ReactDOM from "react-dom/client";
import "milligram/dist/milligram.css";
import "./index.css";
import App from "./App";
import { StoreProvider } from "easy-peasy";
import { store } from "./store/store";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <StoreProvider store={store}>
      <App />
    </StoreProvider>
  </React.StrictMode>
);
