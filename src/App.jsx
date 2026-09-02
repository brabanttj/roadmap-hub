import RoadmapPlanner from "./features/RoadmapPlanner.jsx";
import { PasswordGateProvider } from "./lib/PasswordGate.jsx";

export default function App() {
  return (
    <PasswordGateProvider>
      <main>
        <RoadmapPlanner />
      </main>
    </PasswordGateProvider>
  );
}
