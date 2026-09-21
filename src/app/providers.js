"use client";

import { SessionProvider } from "next-auth/react";
import { Agentation } from "agentation";

export default function Providers({ children }) {
  return (
    <SessionProvider>
      {children}
      {process.env.NODE_ENV === "development" && (
        <Agentation
          appName="AMOR ATELIEER"
          endpoint="http://localhost:4747"
        />
      )}
    </SessionProvider>
  );
}
