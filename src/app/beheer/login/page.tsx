import Login from "./Login";
export const metadata = { title: "Inloggen" };
export default async function Page({ searchParams }: { searchParams: Promise<{ reden?: string }> }) {
  const sp = await searchParams;
  return (
    <>
      {sp.reden === "inactief" && <div className="alert" style={{ maxWidth: 420, margin: "20px auto 0", width: "100%" }}>Je bent uitgelogd na 30 minuten zonder activiteit. Log opnieuw in.</div>}
      <Login />
    </>
  );
}
