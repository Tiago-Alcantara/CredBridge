"use client";

import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";
import { useGoogleSignIn, type GoogleAuthResponse } from "@/lib/api/auth";

interface GoogleSignInButtonProps {
  onSuccess: (data: GoogleAuthResponse) => void;
  onError?: (message: string) => void;
  text?: "signin_with" | "signup_with" | "continue_with";
}

export function GoogleSignInButton({
  onSuccess,
  onError,
  text = "continue_with",
}: GoogleSignInButtonProps) {
  const mutation = useGoogleSignIn();

  const handleCredential = (resp: CredentialResponse) => {
    if (!resp.credential) {
      onError?.("Falha ao obter credencial Google");
      return;
    }
    mutation.mutate(resp.credential, {
      onSuccess,
      onError: () => onError?.("Falha ao autenticar com Google"),
    });
  };

  return (
    <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
      <GoogleLogin
        onSuccess={handleCredential}
        onError={() => onError?.("Falha ao autenticar com Google")}
        theme="filled_black"
        size="large"
        text={text}
        shape="rectangular"
        width="320"
      />
    </div>
  );
}
