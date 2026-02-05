"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Mail, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email");
  const errorParam = searchParams.get("error");

  const [email, setEmail] = useState(emailParam || "");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [resendError, setResendError] = useState("");

  async function handleResend() {
    if (!email) return;
    setSending(true);
    setResendError("");
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setSent(true);
      } else {
        setResendError("Failed to resend. Please try again.");
      }
    } catch {
      setResendError("Something went wrong.");
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
          {errorParam ? (
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
          ) : (
            <Mail className="h-12 w-12 text-primary mx-auto mb-2" />
          )}
          <CardTitle>
            {errorParam ? "Verification Failed" : "Check Your Email"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {errorParam ? (
            <p className="text-sm text-muted-foreground">
              {decodeURIComponent(errorParam)}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              We sent a verification link to{" "}
              <strong>{emailParam || "your email"}</strong>. Click the link to
              activate your account.
            </p>
          )}

          {sent ? (
            <div className="flex items-center justify-center gap-2 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              <span>Verification email resent!</span>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Didn&apos;t receive it? Enter your email to resend.
              </p>
              <div>
                <Label htmlFor="resend-email" className="sr-only">
                  Email
                </Label>
                <Input
                  id="resend-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              {resendError && (
                <p className="text-sm text-red-600">{resendError}</p>
              )}
              <Button
                onClick={handleResend}
                disabled={sending || !email}
                className="w-full"
              >
                {sending ? "Sending..." : "Resend Verification Email"}
              </Button>
            </div>
          )}

          <p className="text-sm text-muted-foreground pt-2">
            Already verified?{" "}
            <Link href="/login" className="underline">
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}
