import { Route, Routes } from "react-router-dom";
import { LandingPage } from "./components/pages/LandingPage";
import { ProtectedShell } from "./components/pages/ProtectedShell";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/*" element={<ProtectedShell />} />
    </Routes>
  );
}
