"use client";
import { useState } from "react";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Modal from "@cloudscape-design/components/modal";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { api } from "@/lib/api";
import { COPY } from "@/lib/copy";
import type { Zone } from "@/lib/types";

export function DeleteZoneModal({ zone, onClose, onDeleted }: { zone: Zone; onClose: () => void; onDeleted: () => void }) {
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function confirm() {
    setBusy(true); setErr("");
    try { await api.zones.remove(zone.id); onDeleted(); } catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  return (
    <Modal visible onDismiss={onClose} header="Delete hosted zone" footer={
      <Box float="right"><SpaceBetween direction="horizontal" size="xs">
        <Button variant="link" onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={busy} disabled={text !== COPY.deleteConfirmWord} onClick={confirm}>Delete</Button>
      </SpaceBetween></Box>
    }>
      <SpaceBetween size="m">
        {err && <Alert type="error">{err}</Alert>}
        <Box>Are you sure you want to delete the hosted zone <b>{zone.name}</b>? This can&apos;t be undone.</Box>
        <FormField label={<>To confirm deletion, type <i>{COPY.deleteConfirmWord}</i> in the field.</>}>
          <Input value={text} onChange={({ detail }) => setText(detail.value)} placeholder={COPY.deleteConfirmWord} />
        </FormField>
      </SpaceBetween>
    </Modal>
  );
}

export function EditZoneModal({ zone, onClose, onSaved }: { zone: Zone; onClose: () => void; onSaved: () => void }) {
  const [desc, setDesc] = useState(zone.description);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true); setErr("");
    try { await api.zones.update(zone.id, desc); onSaved(); } catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  return (
    <Modal visible onDismiss={onClose} header="Edit hosted zone" footer={
      <Box float="right"><SpaceBetween direction="horizontal" size="xs">
        <Button variant="link" onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={busy} onClick={save}>Save</Button>
      </SpaceBetween></Box>
    }>
      <SpaceBetween size="m">
        {err && <Alert type="error">{err}</Alert>}
        <FormField label="Hosted zone name"><Input value={zone.name} disabled /></FormField>
        <FormField label="Description" description="The hosted zone description can't be longer than 256 characters."><Input value={desc} onChange={({ detail }) => setDesc(detail.value)} /></FormField>
      </SpaceBetween>
    </Modal>
  );
}
