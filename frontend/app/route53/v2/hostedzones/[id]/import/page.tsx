"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Alert from "@cloudscape-design/components/alert";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Textarea from "@cloudscape-design/components/textarea";
import { useFlash } from "@/components/FlashProvider";
import { usePageMeta } from "@/components/PageMeta";
import { api } from "@/lib/api";
import { ZONES, zoneUrl } from "@/lib/copy";

export default function ImportZoneFile() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const notify = useFlash();
  const [name, setName] = useState(id);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  usePageMeta({ breadcrumbs: [{ text: "Hosted zones", href: ZONES }, { text: name, href: zoneUrl(id) }, { text: "Import zone file", href: `${zoneUrl(id)}/import` }] });
  useEffect(() => { api.zones.get(id).then((z) => setName(z.name)).catch(() => undefined); }, [id]);

  async function submit() {
    setBusy(true); setErr("");
    try {
      const r = await api.records.importZoneFile(id, text);
      notify("success", `Successfully imported ${r.imported} ${r.imported === 1 ? "record" : "records"} into ${name}.`);
      router.push(zoneUrl(id));
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  return (
    <Form
      header={<Header variant="h1" info={<Link variant="info">Info</Link>} description="Paste the contents of a BIND-format zone file to create all of its records at once.">Import zone file</Header>}
      actions={<SpaceBetween direction="horizontal" size="xs"><Button variant="link" onClick={() => router.push(zoneUrl(id))}>Cancel</Button><Button variant="primary" loading={busy} disabled={!text.trim()} onClick={submit}>Import</Button></SpaceBetween>}
    >
      <SpaceBetween size="l">
        {err && <Alert type="error" header="Couldn't import the zone file">{err}</Alert>}
        <Container header={<Header variant="h2">Zone file</Header>}>
          <FormField label="Zone file" description={`Route 53 ignores the SOA record and NS records named ${name}. If any record already exists, nothing is imported.`} constraintText="$GENERATE and $INCLUDE aren't supported.">
            <Textarea value={text} rows={16} placeholder={`$ORIGIN ${name}.\n$TTL 300\n@    IN A     192.0.2.1\nwww  IN CNAME ${name}.\n@    IN MX    10 mail.${name}.`} onChange={({ detail }) => setText(detail.value)} />
          </FormField>
        </Container>
      </SpaceBetween>
    </Form>
  );
}
