"use client";

import dynamic from "next/dynamic";

/**
 * BF3: the chat widget's code loads after the page, never with it. /rtw and the
 * homepage hero were tuned twice for LCP; on a first visit the cookie banner is
 * the LCP and paints after hydration, so nothing of chat may compete with it.
 */
export const ChatWidgetLazy = dynamic(() => import("@/components/chat/ChatWidget").then((m) => m.ChatWidget), {
  ssr: false,
  loading: () => null,
});
