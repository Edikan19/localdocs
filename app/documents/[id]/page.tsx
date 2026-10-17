
import { Suspense } from "react";
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

  return <DocumentEditor documentId={id} />;
}
