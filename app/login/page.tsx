import { Suspense } from "react";
import LoginModal from "./LoginModal";

export const metadata = {
  title: "FoxVize — Giris",
  robots: { index: false, follow: false, nocache: true },
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginModal />
    </Suspense>
  );
}
