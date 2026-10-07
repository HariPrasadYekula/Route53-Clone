"use client";
import { useEffect, useState } from "react";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import RecordFields, { FieldErrors, draftFromRecord, draftToInput, ttlError } from "./RecordForm";
import { ApiError, api } from "@/lib/api";
import type { DnsRecord } from "@/lib/types";

export default function EditRecordPanel({ zoneId, zoneName, record, onClose, onSaved }: {
  zoneId: string; zoneName: string; record: DnsRecord; onClose: () => void; onSaved: (r: DnsRecord) => void;
}) {
  const [draft, setDraft] = useState(() => draftFromRecord(record, zoneName));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [top, setTop] = useState(0);
  const system = record.type === "NS" || record.type === "SOA";

  useEffect(() => { setDraft(draftFromRecord(record, zoneName)); setErrors({}); setMessage(""); }, [record.id, record.updated_at, zoneName]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const measure = () => setTop(document.getElementById("h")?.getBoundingClientRect().bottom ?? 0);
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure);
    return () => { window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure); };
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save() {
    setErrors({}); setMessage("");
    const badTtl = ttlError(draft);
    if (badTtl) { setErrors({ ttl: badTtl }); return; }
    setBusy(true);
    try { onSaved(await api.records.update(zoneId, record.id, draftToInput(draft))); }
    catch (e) {
      const err = e as ApiError;
      if (err.field) setErrors({ [err.field]: err.message });
      setMessage(err.message); setBusy(false);
    }
  }

  return (
    <aside role="complementary" aria-label="Edit record" className="edit-panel" style={{ top }}>
      <div className="edit-panel-body">
        <SpaceBetween size="l">
          <Header variant="h2" actions={<Button variant="icon" iconName="close" ariaLabel="Close" onClick={onClose} />}>Edit record</Header>
          {system && <Alert type="info">NS and SOA records are managed by Route 53. You can change only the TTL.</Alert>}
          {message && <Alert type="error" header="Couldn't save the record">{message}</Alert>}
          <RecordFields draft={draft} onChange={setDraft} zoneName={zoneName} errors={errors} lockName={system} lockType={system} ttlOnly={system} />
        </SpaceBetween>
      </div>
      <div className="edit-panel-footer">
        <Box float="right"><SpaceBetween direction="horizontal" size="xs">
          <Button variant="link" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy} onClick={save}>Save changes</Button>
        </SpaceBetween></Box>
      </div>
    </aside>
  );
}
