import { useState } from "react";
import { useLocation } from "wouter";
import { login } from "../lib/auth";
import { LoginForm, SmokeyBackground } from "@/components/ui/login-form";

export default function LoginScreen() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (username: string, password: string) => {
    setLoading(true);
    setError("");
    try {
      await login(username, password);
      setLocation("/dashboard", { replace: true });
    } catch {
      setError("Invalid username or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative h-screen w-screen bg-gray-900">
      <SmokeyBackground className="absolute inset-0" />
      <div className="relative z-10 flex h-full w-full items-center justify-center p-4">
        <LoginForm onSubmit={handleSubmit} loading={loading} error={error} />
      </div>
    </main>
  );
}
