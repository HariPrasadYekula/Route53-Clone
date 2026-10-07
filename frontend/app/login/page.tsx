"use client";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useAuth } from "@/components/AuthProvider";
import { ROUTE53_HOME } from "@/lib/copy";

export default function Login() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const [account, setAccount] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!loading && user) router.replace(ROUTE53_HOME); }, [loading, user, router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try { await login(username.trim(), password, account.trim()); router.replace(ROUTE53_HOME); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="signin-wrap">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/aws-logo-dark.svg" alt="AWS" width={90} height={54} style={{ marginBottom: 16 }} />
      <form className="signin-card" onSubmit={submit}>
        <SpaceBetween size="l">
          <Box variant="h1" fontSize="heading-xl">Sign in</Box>
          {error && <Alert type="error">{error}</Alert>}
          <FormField label="Account ID or alias" constraintText="Optional in this demo.">
            <Input value={account} onChange={({ detail }) => setAccount(detail.value)} placeholder="123456789012" />
          </FormField>
          <FormField label="IAM user name"><Input value={username} onChange={({ detail }) => setUsername(detail.value)} autoFocus /></FormField>
          <FormField label="Password"><Input type="password" value={password} onChange={({ detail }) => setPassword(detail.value)} /></FormField>
          <Button variant="primary" formAction="submit" loading={busy} fullWidth disabled={!username || !password}>Sign in</Button>
          <Box color="text-body-secondary" fontSize="body-s">Demo credentials: <b>admin</b> / <b>admin123</b></Box>
          <hr style={{ border: 0, borderTop: "1px solid #d5dbdb", margin: 0 }} />
          <Box textAlign="center">
            <Button fullWidth onClick={() => router.push("/signup")}>Create a new AWS account</Button>
          </Box>
        </SpaceBetween>
      </form>
      <Box color="text-body-secondary" fontSize="body-s" padding={{ top: "xl" }}>© {new Date().getFullYear()}, Amazon Web Services, Inc. or its affiliates.</Box>
    </div>
  );
}
