import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import { Links } from "./pages/links";
import { Index } from "./pages";

const router = createBrowserRouter([
  {
    path: "/startpage",
    element: <Index />,
  },
  {
    path: "/startpage/links",
    element: <Links />,
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
