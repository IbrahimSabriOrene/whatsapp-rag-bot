"use client";

import dynamic from "next/dynamic";

const App = dynamic(() => import("./rag-bot-app"), { ssr: false });

export default function Home() {
  return <App />;
}
