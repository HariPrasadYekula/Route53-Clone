"use client";
import { useState } from "react";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Modal from "@cloudscape-design/components/modal";
import Select from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { TYPE_OPTIONS } from "./RecordForm";
import { api } from "@/lib/api";
import type { TestResult, Zone } from "@/lib/types";

export default function TestRecordModal({ zone, onClose }: { zone: Zone; onClose: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState(TYPE_OPTIONS[0]);
  const [res, setRes] = useState<TestResult | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true); setErr("");
    try { setRes(await api.records.test(zone.id, name, type.value ?? "A")); } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }
  return (
    <Modal visible onDismiss={onClose} size="large" header="Test record"
      footer={<Box float="right"><Button variant="primary" onClick={onClose}>Close</Button></Box>}>
      <SpaceBetween size="l">
        <Box color="text-body-secondary">Simulates how Route 53 responds to a DNS query for a record in this hosted zone.</Box>
        {err && <Alert type="error">{err}</Alert>}
        <ColumnLayout columns={2}>
          <FormField label="Record name" description="Keep blank to test the root domain.">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ flex: 1 }}><Input value={name} onChange={({ detail }) => setName(detail.value)} /></div><span>.{zone.name}</span></div>
          </FormField>
          <FormField label="Record type"><Select selectedOption={type} options={TYPE_OPTIONS} onChange={({ detail }) => setType(detail.selectedOption)} /></FormField>
        </ColumnLayout>
        <Button loading={busy} onClick={run}>Get response</Button>
        {res && (
          <SpaceBetween size="s">
            <div><Box variant="awsui-key-label">Response returned by Route 53</Box>
              <Box><b>{res.response_code}</b> for {res.record_name} ({res.record_type})</Box></div>
            <div><Box variant="awsui-key-label">Response</Box>
              <pre className="answer-box">{res.answers.length ? res.answers.join("\n") : "(no answer)"}</pre></div>
            {res.ttl !== undefined && <div><Box variant="awsui-key-label">TTL (seconds)</Box><Box>{res.ttl || "-"}</Box></div>}
          </SpaceBetween>
        )}
      </SpaceBetween>
    </Modal>
  );
}
