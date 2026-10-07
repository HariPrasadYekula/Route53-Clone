"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Alert from "@cloudscape-design/components/alert";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Form from "@cloudscape-design/components/form";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import Spinner from "@cloudscape-design/components/spinner";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useFlash } from "@/components/FlashProvider";
import { usePageMeta } from "@/components/PageMeta";
import RecordFields, { FieldErrors, RecordDraft, draftToInput, newDraft, ttlError } from "@/components/RecordForm";
import { ApiError, api } from "@/lib/api";
import { ZONES, zoneUrl } from "@/lib/copy";
import type { Zone } from "@/lib/types";

export default function CreateRecord() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const notify = useFlash();
  const [zone, setZone] = useState<Zone | null>(null);
  const [drafts, setDrafts] = useState<RecordDraft[]>(() => [newDraft()]);
  const [errors, setErrors] = useState<Record<string, FieldErrors>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  usePageMeta({ breadcrumbs: [{ text: "Hosted zones", href: ZONES }, { text: zone?.name ?? id, href: zoneUrl(id) }, { text: "Create record", href: `${zoneUrl(id)}/create-record` }] });
  useEffect(() => { api.zones.get(id).then(setZone).catch((e) => notify("error", (e as Error).message)); }, [id, notify]);
  if (!zone) return <SpaceBetween size="l"><Spinner size="large" /></SpaceBetween>;

  const update = (key: string, d: RecordDraft) => setDrafts((ds) => ds.map((x) => (x.key === key ? d : x)));

  async function submit() {
    setErrors({}); setMessage("");
    const ttlErrors: Record<string, FieldErrors> = {};
    drafts.forEach((d) => { const m = ttlError(d); if (m) ttlErrors[d.key] = { ttl: m }; });
    if (Object.keys(ttlErrors).length) { setErrors(ttlErrors); return; }
    setBusy(true);
    try {
      const created = await api.records.create(id, drafts.map(draftToInput));
      notify("success", created.length === 1 ? `Successfully created record ${created[0].name}.` : `Successfully created ${created.length} records.`);
      router.push(zoneUrl(id));
    } catch (e) {
      const err = e as ApiError;
      const target = drafts[err.index ?? 0] ?? drafts[0];
      if (err.field) setErrors({ [target.key]: { [err.field]: err.message } });
      setMessage(drafts.length > 1 && err.index != null ? `Record ${err.index + 1}: ${err.message}` : err.message);
      setBusy(false);
    }
  }

  return (
    <Form
      header={<Header variant="h1" info={<Link variant="info">Info</Link>} description={`Create one or more records in ${zone.name}.`}>Create record</Header>}
      errorText={undefined}
      actions={
        <SpaceBetween direction="horizontal" size="xs">
          <Button variant="link" onClick={() => router.push(zoneUrl(id))}>Cancel</Button>
          <Button variant="primary" loading={busy} onClick={submit}>Create records</Button>
        </SpaceBetween>
      }
    >
      <SpaceBetween size="l">
        {message && <Alert type="error" header="Couldn't create the records" dismissible onDismiss={() => setMessage("")}>{message}</Alert>}
        {drafts.map((d, i) => (
          <Container
            key={d.key}
            header={<Header variant="h2" actions={<Button disabled={drafts.length === 1} onClick={() => setDrafts((ds) => ds.filter((x) => x.key !== d.key))}>Delete</Button>}>Record {i + 1}</Header>}
          >
            <RecordFields draft={d} onChange={(nd) => update(d.key, nd)} zoneName={zone.name} errors={errors[d.key]} />
          </Container>
        ))}
        <div><Button iconName="add-plus" onClick={() => setDrafts((ds) => [...ds, newDraft()])}>Add another record</Button></div>
      </SpaceBetween>
    </Form>
  );
}
