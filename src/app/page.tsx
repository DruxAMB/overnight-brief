import { LandingShell } from "@/components/landing-shell";
import { Workbench } from "@/components/workbench";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ app?: string }>;
}) {
  const params = await searchParams;
  const initialApp = params.app === "1";

  return (
    <LandingShell initialApp={initialApp}>
      <Workbench />
    </LandingShell>
  );
}
