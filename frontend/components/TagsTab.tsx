"use client";
import { useCallback, useEffect, useState } from "react";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import Input from "@cloudscape-design/components/input";
import Link from "@cloudscape-design/components/link";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Table from "@cloudscape-design/components/table";
import { useFlash } from "./FlashProvider";
import { api } from "@/lib/api";
import type { Tag } from "@/lib/types";

export default function TagsTab({ zoneId, onCount }: { zoneId: string; onCount: (n: number) => void }) {
  const notify = useFlash();
  const [tags, setTags] = useState<Tag[]>([]);
  const [draft, setDraft] = useState<Tag[]>([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try { const t = await api.zones.tags(zoneId); setTags(t); onCount(t.length); } catch (e) { notify("error", (e as Error).message); }
    finally { setLoading(false); }
  }, [zoneId, notify, onCount]);
  useEffect(() => { load(); }, [load]);

  async function save() {
    const clean = draft.filter((t) => t.key.trim());
    if (new Set(clean.map((t) => t.key.trim())).size !== clean.length) { setErr("Tag keys must be unique."); return; }
    setBusy(true); setErr("");
    try {
      const saved = await api.zones.setTags(zoneId, clean.map((t) => ({ key: t.key.trim(), value: t.value })));
      setTags(saved); onCount(saved.length); setEditing(false);
      notify("success", "Successfully updated the hosted zone tags.");
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  if (editing) {
    const set = (i: number, p: Partial<Tag>) => setDraft((d) => d.map((t, j) => (j === i ? { ...t, ...p } : t)));
    return (
      <Container header={<Header variant="h2" info={<Link variant="info">Info</Link>} description="A tag is a label that you assign to an AWS resource. Each tag consists of a key and an optional value.">Manage tags</Header>}
        footer={<Box float="right"><SpaceBetween direction="horizontal" size="xs"><Button variant="link" onClick={() => setEditing(false)}>Cancel</Button><Button variant="primary" loading={busy} onClick={save}>Save changes</Button></SpaceBetween></Box>}>
        <SpaceBetween size="s">
          {err && <Alert type="error">{err}</Alert>}
          {draft.length === 0 && <Box color="text-body-secondary">No tags associated with the resource.</Box>}
          {draft.map((t, i) => (
            <SpaceBetween key={i} direction="horizontal" size="s" alignItems="end">
              <FormField label={i === 0 ? "Key" : undefined}><Input value={t.key} placeholder="Enter key" onChange={({ detail }) => set(i, { key: detail.value })} /></FormField>
              <FormField label={i === 0 ? <>Value - <i>optional</i></> : undefined}><Input value={t.value} placeholder="Enter value" onChange={({ detail }) => set(i, { value: detail.value })} /></FormField>
              <Button onClick={() => setDraft((d) => d.filter((_, j) => j !== i))}>Remove</Button>
            </SpaceBetween>
          ))}
          <Button onClick={() => setDraft((d) => [...d, { key: "", value: "" }])}>Add new tag</Button>
        </SpaceBetween>
      </Container>
    );
  }
  return (
    <Table
      variant="container" items={tags} loading={loading} loadingText="Loading tags" trackBy="key"
      columnDefinitions={[{ id: "k", header: "Key", cell: (t) => t.key }, { id: "v", header: "Value", cell: (t) => t.value || "-" }]}
      header={<Header counter={`(${tags.length})`} info={<Link variant="info">Info</Link>} actions={<Button onClick={() => { setDraft(tags.map((t) => ({ ...t }))); setErr(""); setEditing(true); }}>Manage tags</Button>}>Hosted zone tags</Header>}
      empty={<Box textAlign="center" color="inherit" padding={{ vertical: "l" }}><SpaceBetween size="m"><div><Box variant="strong" color="inherit">No tags</Box><Box color="inherit">No tags associated with the resource.</Box></div><Button onClick={() => { setDraft([{ key: "", value: "" }]); setEditing(true); }}>Manage tags</Button></SpaceBetween></Box>}
    />
  );
}
