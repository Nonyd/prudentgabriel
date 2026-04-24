"use client";

import * as Toast from "@radix-ui/react-toast";

export function Toaster() {
  return (
    <Toast.Provider duration={4000} swipeDirection="right">
      <Toast.Viewport className="fixed bottom-0 right-0 z-[100] flex max-h-screen w-[420px] max-w-[100vw] flex-col gap-2 p-6 outline-none" />
    </Toast.Provider>
  );
}
