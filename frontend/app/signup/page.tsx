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
import { useFlash } from "@/components/FlashProvider";
import { ApiError } from "@/lib/api";
import { ROUTE53_HOME } from "@/lib/copy";

type Errors = Partial<Record<"username" | "password" | "confirm" | "account_name", string>>;

const fmtId = (id: string) => id.replace(/(\d{4})(?=\d)/g, "$1-");

/** Same rules as the API, so most mistakes are caught before a request is sent. */
function validate(username: string, password: string, confirm: string, accountName: string): Errors {
  const errors: Errors = {};
  if (username.length < 3 || username.length > 64 || !/^[A-Za-z0-9+=,.@_-]+$/.test(username)) {
    errors.username = "User name must be 3 to 64 characters: letters, numbers and + = , . @ _ - only.";
  }
  if (password.length < 8 || password.length > 128) errors.password = "Password must be between 8 and 128 characters.";
  if (confirm !== password) errors.confirm = "The passwords don't match.";
  if (accountName.length > 64) errors.account_name = "Account alias can have at most 64 characters.";
  return errors;
}

export default function Signup() {
  const { user, loading, signup } = useAuth();
  const notify = useFlash();
  const router = useRouter();
  const [accountName, setAccountName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => { if (!loading && user && !done) router.replace(ROUTE53_HOME); }, [loading, user, done, router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const found = validate(username.trim(), password, confirm, accountName.trim());
    setErrors(found); setError("");
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      setDone(true);
      const created = await signup(username.trim(), password, accountName.trim());
      notify("success", `Your account was created. Your account ID is ${fmtId(created.account_id)}.`);
      router.replace(ROUTE53_HOME);
    } catch (err) {
      setDone(false);
      const apiErr = err as ApiError;
      if (apiErr.field === "username" || apiErr.field === "password" || apiErr.field === "account_name") {
        setErrors({ [apiErr.field]: apiErr.message });
      } else {
        setError(apiErr.message);
      }
      setBusy(false);
    }
  }

  return (
    <div className="signin-wrap">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/aws-logo-dark.svg" alt="AWS" width={90} height={54} style={{ marginBottom: 16 }} />
      <form className="signin-card" onSubmit={submit} noValidate>
        <SpaceBetween size="l">
          <Box variant="h1" fontSize="heading-xl">Create an account</Box>
          {error && <Alert type="error">{error}</Alert>}
          <FormField label="Account alias" constraintText="Optional. A friendly name shown next to your account ID." errorText={errors.account_name}>
            <Input value={accountName} invalid={!!errors.account_name} onChange={({ detail }) => setAccountName(detail.value)} placeholder="my-company" />
          </FormField>
          <FormField label="IAM user name" constraintText="3 to 64 characters: letters, numbers and + = , . @ _ -" errorText={errors.username}>
            <Input value={username} invalid={!!errors.username} onChange={({ detail }) => setUsername(detail.value)} autoFocus />
          </FormField>
          <FormField label="Password" constraintText="At least 8 characters." errorText={errors.password}>
            <Input type="password" value={password} invalid={!!errors.password} onChange={({ detail }) => setPassword(detail.value)} />
          </FormField>
          <FormField label="Confirm password" errorText={errors.confirm}>
            <Input type="password" value={confirm} invalid={!!errors.confirm} onChange={({ detail }) => setConfirm(detail.value)} />
          </FormField>
          <Button variant="primary" formAction="submit" loading={busy} fullWidth disabled={!username || !password || !confirm}>Create account</Button>
          <hr style={{ border: 0, borderTop: "1px solid #d5dbdb", margin: 0 }} />
          <Box textAlign="center">
            <Button fullWidth onClick={() => router.push("/login")}>Sign in to an existing account</Button>
          </Box>
        </SpaceBetween>
      </form>
      <Box color="text-body-secondary" fontSize="body-s" padding={{ top: "xl" }}>© {new Date().getFullYear()}, Amazon Web Services, Inc. or its affiliates.</Box>
    </div>
  );
}
