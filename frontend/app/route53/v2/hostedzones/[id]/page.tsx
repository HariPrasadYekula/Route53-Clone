"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Alert from "@cloudscape-design/components/alert";
import Badge from "@cloudscape-design/components/badge";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import ButtonDropdown from "@cloudscape-design/components/button-dropdown";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Container from "@cloudscape-design/components/container";
import ExpandableSection from "@cloudscape-design/components/expandable-section";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import Spinner from "@cloudscape-design/components/spinner";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Tabs from "@cloudscape-design/components/tabs";
import { useFlash } from "@/components/FlashProvider";
import { usePageMeta } from "@/components/PageMeta";
import RecordsTab from "@/components/RecordsTab";
import TagsTab from "@/components/TagsTab";
import TestRecordModal from "@/components/TestRecordModal";
import { DeleteZoneModal, EditZoneModal } from "@/components/ZoneModals";
import { ApiError, api } from "@/lib/api";
import { ZONES, zoneUrl } from "@/lib/copy";
import type { Zone } from "@/lib/types";

const KV = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div><Box variant="awsui-key-label">{label}</Box><div>{children || "-"}</div></div>
);

export default function ZoneDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const notify = useFlash();
  const [zone, setZone] = useState<Zone | null>(null);
  const [missing, setMissing] = useState(false);
  const [tab, setTab] = useState("records");
  const [tagCount, setTagCount] = useState<number | null>(null);
  const [modal, setModal] = useState<"delete" | "edit" | "test" | null>(null);

  usePageMeta({ breadcrumbs: [{ text: "Hosted zones", href: ZONES }, { text: zone?.name ?? id, href: zoneUrl(id) }] });

  const load = useCallback(async () => {
    try { setZone(await api.zones.get(id)); setMissing(false); }
    catch (e) { if (e instanceof ApiError && e.status === 404) setMissing(true); else notify("error", (e as Error).message); }
  }, [id, notify]);
  useEffect(() => { load(); }, [load]);

  if (missing) {
    return (
      <SpaceBetween size="l">
        <Header variant="h1">Hosted zone not found</Header>
        <Alert type="error" header="No hosted zone found">No hosted zone found with ID: {id}. It may have been deleted.</Alert>
        <Button onClick={() => router.push(ZONES)}>Back to hosted zones</Button>
      </SpaceBetween>
    );
  }
  if (!zone) return <Box textAlign="center" padding="xxl"><Spinner size="large" /></Box>;

  return (
    <SpaceBetween size="l">
      <Header
        variant="h1"
        info={<Link variant="info">Info</Link>}
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button onClick={() => setModal("delete")}>Delete zone</Button>
            <Button onClick={() => setModal("test")}>Test record</Button>
            <Button onClick={() => notify("info", "Query logging isn't available in this Route 53 clone.")}>Configure query logging</Button>
            <ButtonDropdown
              ariaLabel="More hosted zone actions"
              items={[{ id: "json", text: "Export as JSON" }, { id: "bind", text: "Export as BIND zone file" }]}
              onItemClick={({ detail }) => { window.location.href = api.exportUrl(zone.id, detail.id as "json" | "bind"); }}
            >
              Actions
            </ButtonDropdown>
          </SpaceBetween>
        }
      >
        <SpaceBetween direction="horizontal" size="xs" alignItems="center">
          <span>{zone.name}</span>
          <Badge color={zone.type === "public" ? "blue" : "grey"}>{zone.type === "public" ? "Public" : "Private"}</Badge>
        </SpaceBetween>
      </Header>

      <ExpandableSection
        variant="container"
        headerText="Hosted zone details"
        headerInfo={<Link variant="info">Info</Link>}
        headerActions={<Button onClick={() => setModal("edit")}>Edit hosted zone</Button>}
      >
        <ColumnLayout columns={4} variant="text-grid">
          <KV label="Hosted zone name">{zone.name}</KV>
          <KV label="Hosted zone ID">{zone.id}</KV>
          <KV label="Description">{zone.description}</KV>
          <KV label="Type">{zone.type === "public" ? "Public hosted zone" : "Private hosted zone"}</KV>
          <KV label="Record count">{zone.record_count}</KV>
          <KV label="Created by">{zone.created_by}</KV>
          <div style={{ gridColumn: "span 2" }}>
            <KV label="Name servers">{zone.name_servers?.map((n) => <div key={n}>{n}</div>)}</KV>
          </div>
          {zone.type === "private" && (
            <div style={{ gridColumn: "span 2" }}>
              <KV label="VPC associations">{zone.vpc_id ? `${zone.vpc_id} (${zone.vpc_region})` : null}</KV>
            </div>
          )}
        </ColumnLayout>
      </ExpandableSection>

      <Tabs
        activeTabId={tab}
        onChange={({ detail }) => setTab(detail.activeTabId)}
        tabs={[
          { id: "records", label: `Records (${zone.record_count})`, content: <RecordsTab zone={zone} onChanged={load} /> },
          {
            id: "dnssec", label: "DNSSEC signing",
            content: (
              <Container header={<Header variant="h2" info={<Link variant="info">Info</Link>} actions={<Button variant="primary" onClick={() => notify("info", "DNSSEC signing isn't available in this Route 53 clone.")}>Enable DNSSEC signing</Button>} description="DNSSEC signing lets DNS resolvers validate that DNS responses came from Route 53 and haven't been tampered with.">DNSSEC signing</Header>}>
                <Box color="text-body-secondary">DNSSEC signing is not enabled for this hosted zone.</Box>
              </Container>
            ),
          },
          { id: "tags", label: tagCount === null ? "Hosted zone tags" : `Hosted zone tags (${tagCount})`, content: <TagsTab zoneId={zone.id} onCount={setTagCount} /> },
        ]}
      />

      {modal === "delete" && (
        <DeleteZoneModal zone={zone} onClose={() => setModal(null)} onDeleted={() => { notify("success", `Successfully deleted hosted zone ${zone.name}.`); router.push(ZONES); }} />
      )}
      {modal === "edit" && (
        <EditZoneModal zone={zone} onClose={() => setModal(null)} onSaved={() => { setModal(null); notify("success", `Successfully edited hosted zone ${zone.name}.`); load(); }} />
      )}
      {modal === "test" && <TestRecordModal zone={zone} onClose={() => setModal(null)} />}
    </SpaceBetween>
  );
}
