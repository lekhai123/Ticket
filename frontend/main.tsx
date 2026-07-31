import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./src/index.css"; // File chứa Tailwind CSS directives (@import "tailwindcss"; hoặc @tailwind directives)

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Không tìm thấy element #root trong index.html");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
