"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { KeyRound, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  if (token) {
    return <SetNewPasswordForm token={token} />;
  }

  return <RequestResetForm />;
}

function RequestResetForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setSent(true);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8">
      <div className="relative">
        <Image
          src="/logo.png"
          alt="Take Me Out to the Ballparks"
          width={300}
          height={150}
          className="rounded-3xl opacity-80 drop-shadow-xl"
          priority
        />
      </div>

      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {sent ? (
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-2" />
          ) : (
            <KeyRound className="h-12 w-12 text-primary mx-auto mb-2" />
          )}
          <CardTitle>{sent ? "Check Your Email" : "Reset Password"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {sent ? (
            <>
              <p className="text-sm text-muted-foreground">
                If an account exists with that email, we&apos;ve sent a password
                reset link. Check your inbox and click the link to set a new password.
              </p>
              <p className="text-sm text-muted-foreground">
                The link expires in 1 hour.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Enter your email address and we&apos;ll send you a link to reset
                your password.
              </p>
              <form onSubmit={handleSubmit} className="space-y-3 text-left">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <Button type="submit" className="w-full" disabled={sending || !email}>
                  {sending ? "Sending..." : "Send Reset Link"}
                </Button>
              </form>
            </>
          )}

          <p className="text-sm text-muted-foreground pt-2">
            <Link href="/login" className="underline">
              Back to login
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function SetNewPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(true);
      } else {
        setError(data.error || "Failed to reset password.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8">
      <div className="relative">
        <Image
          src="/logo.png"
          alt="Take Me Out to the Ballparks"
          width={300}
          height={150}
          className="rounded-3xl opacity-80 drop-shadow-xl"
          priority
        />
      </div>

      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {success ? (
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-2" />
          ) : error && (error.includes("expired") || error.includes("Invalid")) ? (
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
          ) : (
            <KeyRound className="h-12 w-12 text-primary mx-auto mb-2" />
          )}
          <CardTitle>
            {success ? "Password Reset!" : "Set New Password"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {success ? (
            <>
              <p className="text-sm text-muted-foreground">
                Your password has been updated successfully. You can now sign in
                with your new password.
              </p>
              <Link href="/login">
                <Button className="w-full">Go to Login</Button>
              </Link>
            </>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-3 text-left">
                <div>
                  <Label htmlFor="password">New Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    required
                    minLength={8}
                  />
                </div>
                <div>
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    required
                    minLength={8}
                  />
                </div>
                {error && (
                  <div className="space-y-2">
                    <p className="text-sm text-red-600">{error}</p>
                    {(error.includes("expired") || error.includes("Invalid")) && (
                      <Link href="/reset-password">
                        <Button variant="outline" size="sm" className="w-full">
                          Request New Reset Link
                        </Button>
                      </Link>
                    )}
                  </div>
                )}
                {!(error?.includes("expired") || error?.includes("Invalid")) && (
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? "Resetting..." : "Reset Password"}
                  </Button>
                )}
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}
