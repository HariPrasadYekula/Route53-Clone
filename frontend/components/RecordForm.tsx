"use client";
import Button from "@cloudscape-design/components/button";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Link from "@cloudscape-design/components/link";
import Select, { SelectProps } from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Textarea from "@cloudscape-design/components/textarea";
import Toggle from "@cloudscape-design/components/toggle";
import type { DnsRecord, RecordInput } from "@/lib/types";

export interface RecordDraft {
  key: string; name: string; type: string; alias: boolean; aliasTarget: string; values: string; ttl: string; routing: string;
}
export type FieldErrors = Partial<Record<"name" | "type" | "values" | "ttl" | "alias_target", string>>;

let n = 0;
export const newDraft = (): RecordDraft => ({ key: `d${++n}`, name: "", type: "A", alias: false, aliasTarget: "", values: "", ttl: "300", routing: "Simple" });
export const draftFromRecord = (r: DnsRecord, zoneName: string): RecordDraft => ({
  key: `r${r.id}`,
  name: r.name === zoneName ? "" : r.name.replace(new RegExp(`\\.${zoneName.replace(/\./g, "\\.")}$`), ""),
  type: r.type, alias: r.alias, aliasTarget: r.alias_target ?? "", values: r.values.join("\n"), ttl: String(r.alias ? 300 : r.ttl), routing: r.routing_policy,
});
/** Client-side TTL check, so a blank or non-numeric TTL never reaches the API. */
export const ttlError = (d: RecordDraft): string | undefined => {
  if (d.alias) return undefined;
  const t = d.ttl.trim();
  return /^\d+$/.test(t) && Number(t) <= 2147483647 ? undefined : "TTL must be a whole number between 0 and 2147483647 seconds.";
};
export const draftToInput = (d: RecordDraft): RecordInput => ({
  name: d.name.trim(), type: d.type, routing_policy: "Simple",
  ttl: d.alias ? 300 : Number(d.ttl.trim()),
  values: d.alias ? [] : d.values.split("\n").map((v) => v.trim()).filter(Boolean),
  alias_target: d.alias ? d.aliasTarget.trim() : null,
});

const T = (value: string, description: string): SelectProps.Option => ({ value, label: value, description });
export const TYPE_OPTIONS: SelectProps.Option[] = [
  T("A", "Routes traffic to an IPv4 address and some AWS resources"),
  T("AAAA", "Routes traffic to an IPv6 address and some AWS resources"),
  T("CAA", "Restricts CAs that can create SSL/TLS certifications for the domain"),
  T("CNAME", "Routes traffic to another domain name and to some AWS resources"),
  T("MX", "Routes traffic to mail servers"),
  T("NS", "Routes traffic using name server (NS) records"),
  T("PTR", "Maps an IP address to a domain name"),
  T("SRV", "Application-specific values that identify servers"),
  T("TXT", "Used to verify email senders and for application-specific values"),
];
const ROUTING_OPTIONS: SelectProps.Option[] = [
  { value: "Simple", label: "Simple routing" },
  ...["Weighted", "Geolocation", "Latency", "Failover", "Multivalue answer", "IP-based"].map((v) => ({ value: v, label: `${v} routing`.replace("Multivalue answer routing", "Multivalue answer").replace("IP-based routing", "IP-based routing"), disabled: true, disabledReason: "Not available in this clone" })),
];
const HINTS: Record<string, { placeholder: string; multi: boolean }> = {
  A: { placeholder: "192.0.2.235", multi: true },
  AAAA: { placeholder: "2001:0db8:85a3:0:0:8a2e:0370:7334", multi: true },
  CAA: { placeholder: '0 issue "ca.example.net"', multi: true },
  CNAME: { placeholder: "www.example.com", multi: false },
  MX: { placeholder: "10 mail.example.com", multi: true },
  NS: { placeholder: "ns-1.example.net", multi: true },
  PTR: { placeholder: "www.example.com", multi: true },
  SRV: { placeholder: "1 10 5269 xmpp-server.example.com", multi: true },
  TXT: { placeholder: '"Sample text"', multi: true },
};

interface Props {
  draft: RecordDraft; onChange: (d: RecordDraft) => void; zoneName: string; errors?: FieldErrors;
  lockName?: boolean; lockType?: boolean; ttlOnly?: boolean;
}

export default function RecordFields({ draft, onChange, zoneName, errors = {}, lockName, lockType, ttlOnly }: Props) {
  const set = (patch: Partial<RecordDraft>) => onChange({ ...draft, ...patch });
  const hint = HINTS[draft.type] ?? HINTS.A;
  const typeOpt = TYPE_OPTIONS.find((o) => o.value === draft.type) ?? { value: draft.type, label: draft.type };
  const fixed = lockName || ttlOnly;
  return (
    <SpaceBetween size="l">
      <FormField label="Record name" info={<Link variant="info">Info</Link>} errorText={errors.name} description={fixed ? undefined : "Keep blank to create a record for the root domain."} stretch>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}><Input value={draft.name} disabled={fixed} invalid={!!errors.name} placeholder={fixed ? zoneName : undefined} onChange={({ detail }) => set({ name: detail.value })} /></div>
          <span style={{ whiteSpace: "nowrap", color: "#5f6b7a" }}>.{zoneName}</span>
        </div>
      </FormField>
      <FormField label="Record type" info={<Link variant="info">Info</Link>} errorText={errors.type} description="The routing policy and record type determine how Route 53 responds to queries.">
        <Select
          selectedOption={typeOpt} options={TYPE_OPTIONS} disabled={lockType || ttlOnly} invalid={!!errors.type} selectedAriaLabel="Selected"
          onChange={({ detail }) => set({ type: detail.selectedOption.value ?? "A", alias: draft.alias && ["A", "AAAA", "CNAME", "MX", "TXT", "SRV", "CAA"].includes(detail.selectedOption.value ?? "") })}
        />
      </FormField>
      {!ttlOnly && (
        <Toggle checked={draft.alias} onChange={({ detail }) => set({ alias: detail.checked })} disabled={["NS", "PTR"].includes(draft.type)}>Alias</Toggle>
      )}
      {draft.alias && !ttlOnly && (
        <FormField label="Route traffic to" errorText={errors.alias_target} description="Enter the domain name that this alias record should point to, for example a load balancer or another record in this zone.">
          <Input value={draft.aliasTarget} invalid={!!errors.alias_target} placeholder="dualstack.my-load-balancer-123.us-east-1.elb.amazonaws.com" onChange={({ detail }) => set({ aliasTarget: detail.value })} />
        </FormField>
      )}
      {!ttlOnly && !draft.alias && (
        <FormField label="Value" info={<Link variant="info">Info</Link>} errorText={errors.values} description={hint.multi ? "Enter multiple values on separate lines." : "Enter a single value."}>
          <Textarea value={draft.values} rows={4} invalid={!!errors.values} placeholder={hint.placeholder} onChange={({ detail }) => set({ values: detail.value })} />
        </FormField>
      )}
      {!(draft.alias && !ttlOnly) && (
        <FormField label="TTL (seconds)" info={<Link variant="info">Info</Link>} errorText={errors.ttl} constraintText="Recommended values: 60 to 172800 (two days)">
          <SpaceBetween direction="horizontal" size="xs" alignItems="center">
            <div style={{ width: 140 }}><Input type="number" inputMode="numeric" value={draft.ttl} invalid={!!errors.ttl} onChange={({ detail }) => set({ ttl: detail.value })} /></div>
            {[["1m", 60], ["1h", 3600], ["1d", 86400]].map(([l, v]) => (
              <Button key={l} onClick={() => set({ ttl: String(v) })}>{l}</Button>
            ))}
          </SpaceBetween>
        </FormField>
      )}
      {!ttlOnly && (
        <FormField label="Routing policy" info={<Link variant="info">Info</Link>} description="Route 53 responds to queries based only on the values in this record.">
          <Select selectedOption={ROUTING_OPTIONS[0]} options={ROUTING_OPTIONS} selectedAriaLabel="Selected" onChange={() => undefined} />
        </FormField>
      )}
    </SpaceBetween>
  );
}
