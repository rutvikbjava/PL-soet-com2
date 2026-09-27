"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createBrowserClient } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = createBrowserClient();

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      // Redirect to dashboard on success
      router.push("/dashboard");
    } catch (err) {
      console.error("Login error:", err);
      setError("An unexpected error occurred during login.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-college-bg flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="card">
          {/* Logo and Branding */}
          <div className="flex flex-col items-center mb-6">
            <Image
              src="/photos/college-logo.png"
              width={64}
              height={64}
              alt="MGM University Logo"
              className="mb-3"
            />
            <h1 className="font-poppins font-bold text-college-accent text-lg text-center">
              MGM University
            </h1>
            <p className="font-poppins text-college-secondary text-sm text-center">
              School of Engineering & Technology
            </p>
            <div className="w-16 h-0.5 bg-college-secondary mx-auto my-4"></div>
            <h2 className="page-heading text-center mb-6">
              EduSphere AI — Staff Portal
            </h2>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="label">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="input-field"
                placeholder="you@mgmu.ac.in"
              />
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="label">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="input-field"
                placeholder="Enter your password"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? "Logging in..." : "Login to Portal"}
            </button>

            {/* Error Message */}
            {error && (
              <p className="text-red-500 text-sm text-center mt-2">{error}</p>
            )}
          </form>
        </div>

        {/* Footer */}
        <p className="text-xs text-gray-400 text-center mt-6 font-poppins">
          © MGM University SOET | EduSphere AI
        </p>
      </div>
    </div>
  );
}
