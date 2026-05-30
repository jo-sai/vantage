import { createBrowserRouter, Navigate } from "react-router";
import { RootLayout } from "./components/RootLayout";
import { CommunicationHub } from "./pages/CommunicationHub";
import { Timeline } from "./pages/Timeline";
import { Finances } from "./pages/Finances";
import { Settings } from "./pages/Settings";
import { Welcome } from "./pages/Welcome";
import { Auth } from "./pages/Auth";
import { JoinViaLink } from "./pages/JoinViaLink";

export const router = createBrowserRouter([
  { path: "/auth", Component: Auth },
  { path: "/welcome", Component: Welcome },
  // Public invite link landing — accessible without authentication
  { path: "/join/:code", Component: JoinViaLink },
  {
    path: "/",
    Component: RootLayout,
    children: [
      { index: true, Component: CommunicationHub },
      { path: "timeline", Component: Timeline },
      { path: "finances", Component: Finances },
      { path: "settings", Component: Settings },
      { path: "*", Component: () => <Navigate to="/" replace /> },
    ],
  },
]);
