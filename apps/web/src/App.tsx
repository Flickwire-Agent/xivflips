import { Center, Loader } from "@mantine/core";
import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";

const LandingPage = lazy(() =>
  import("./components/pages/LandingPage").then((m) => ({ default: m.LandingPage })),
);
const ProtectedShell = lazy(() =>
  import("./components/pages/ProtectedShell").then((m) => ({ default: m.ProtectedShell })),
);

function SuspenseFallback() {
  return (
    <Center mih="100dvh">
      <Loader />
    </Center>
  );
}

export default function App() {
  return (
    <Suspense fallback={<SuspenseFallback />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/*" element={<ProtectedShell />} />
      </Routes>
    </Suspense>
  );
}
