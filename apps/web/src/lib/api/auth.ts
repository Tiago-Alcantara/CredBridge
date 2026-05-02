import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";
import { clearAccessToken, setAccessToken } from "./auth-storage";

export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  role?: "pme" | "investor" | "partner";
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) =>
      apiFetch<AuthResponse>("/auth/login", {
        method: "POST",
        body: input,
        skipAuth: true,
      }),
    onSuccess: (data) => {
      setAccessToken(data.accessToken);
      queryClient.invalidateQueries();
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterInput) =>
      apiFetch<AuthResponse>("/auth/register", {
        method: "POST",
        body: input,
        skipAuth: true,
      }),
    onSuccess: (data) => {
      setAccessToken(data.accessToken);
      queryClient.invalidateQueries();
    },
  });
}

export function logout(): void {
  clearAccessToken();
}
