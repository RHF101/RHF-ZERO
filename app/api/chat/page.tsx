"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import ChatWindow from "@/components/chat/ChatWindow";

export default function ChatPage() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("superai_token");
    if (!token) router.replace("/");
  }, [router]);

  return <ChatWindow />;
}
