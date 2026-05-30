import { RouterProvider } from "react-router";
import { router } from "./routes";
import { RoleProvider } from "./components/RoleContext";
import { CurrencyProvider } from "./components/CurrencyContext";
import { OrgProvider } from "./components/OrgContext";

export default function App() {
  return (
    <OrgProvider>
      <RoleProvider>
        <CurrencyProvider>
          <RouterProvider router={router} />
        </CurrencyProvider>
      </RoleProvider>
    </OrgProvider>
  );
}
