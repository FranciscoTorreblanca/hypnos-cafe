import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerAppSW } from "./offline/registerSW";
import { applyStoredOrientation } from "./hooks/useOrientationPreference";

applyStoredOrientation();

createRoot(document.getElementById("root")!).render(<App />);

// Fire-and-forget SW registration (guarded — no-op in preview/dev)
void registerAppSW();

