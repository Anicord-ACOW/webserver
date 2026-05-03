import { auth } from "@/auth";

export default async function Page() {
  const session = await auth()
  return (
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">React Server Component Usage</h1>
        <pre className="whitespace-pre-wrap break-all px-4 py-6">
          {JSON.stringify(session, null, 2)}
        </pre>
      </div>
  );
}

