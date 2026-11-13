import { Suspense } from "react";
import { ChatView } from "@/components/chat/ChatView";

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <ChatView key={id} conversationId={id} />
    </Suspense>
  );
}
