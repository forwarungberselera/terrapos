import CustomerMenuPage from "./CustomerMenuContent";

export function generateStaticParams() {
  return [{ tenantId: "demo" }];
}

export default function Page() {
  return <CustomerMenuPage />;
}
