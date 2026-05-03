import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initSession } from "./lib/session";

// Patch global fetch to inject Authorization header before any component mounts
initSession();

createRoot(document.getElementById("root")!).render(<App />);
