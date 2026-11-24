import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getDocumentRole } from "@/lib/auth/access";
import DocumentEditor from "./document-editor";

type DocumentPageProps = {
  params: Promise<{ id: string }>;
};

export default function DocumentPage({ params }: DocumentPageProps) {
  return (
    <Suspense
      fallback={
        <main className="editor-page">
          <p style={{ padding: "32px" }}>Loading document...</p>
        </main>
      }
    >
      <DocumentRoute params={params} />
    </Suspense>
  );
}

async function DocumentRoute({ params }: DocumentPageProps) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/documents/${id}`)}`);

  const role = await getDocumentRole(user.id, id);
  if (!role) notFound();

  return <DocumentEditor documentId={id} role={role} userName={user.name} />;
}