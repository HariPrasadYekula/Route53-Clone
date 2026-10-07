"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import CollectionPreferences, { CollectionPreferencesProps } from "@cloudscape-design/components/collection-preferences";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import Modal from "@cloudscape-design/components/modal";
import Pagination from "@cloudscape-design/components/pagination";
import PropertyFilter, { PropertyFilterProps } from "@cloudscape-design/components/property-filter";
import Select from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Table, { TableProps } from "@cloudscape-design/components/table";
import EditRecordPanel from "./EditRecordPanel";
import { useFlash } from "./FlashProvider";
import { TYPE_OPTIONS } from "./RecordForm";
import { api } from "@/lib/api";
import { EMPTY_QUERY, queryToParams } from "@/lib/filters";
import { zoneUrl } from "@/lib/copy";
import type { DnsRecord, Page, Zone } from "@/lib/types";

const ANY = (label: string) => ({ value: "", label });
const TYPES = [ANY("Any type"), ...TYPE_OPTIONS.map((o) => ({ value: o.value!, label: o.label! })), { value: "SOA", label: "SOA" }];
const POLICIES = [ANY("Any routing policy"), { value: "Simple", label: "Simple" }];
const ALIASES = [ANY("Any alias"), { value: "true", label: "Yes" }, { value: "false", label: "No" }];
const FILTER_PROPS: PropertyFilterProps.FilteringProperty[] = [
  { key: "name", propertyLabel: "Record name", groupValuesLabel: "Record name values", operators: [":"] },
  { key: "value", propertyLabel: "Value/Route traffic to", groupValuesLabel: "Value values", operators: [":"] },
];
const COLUMNS = [
  { id: "name", label: "Record name" }, { id: "type", label: "Type" }, { id: "routing", label: "Routing policy" },
  { id: "diff", label: "Differentiator" }, { id: "alias", label: "Alias" }, { id: "value", label: "Value/Route traffic to" },
  { id: "ttl", label: "TTL (seconds)" }, { id: "hc", label: "Health check ID" }, { id: "eth", label: "Evaluate target health" },
];
const isSystem = (r: DnsRecord) => r.type === "NS" || r.type === "SOA";

export default function RecordsTab({ zone, onChanged }: { zone: Zone; onChanged: () => void }) {
  const router = useRouter();
  const notify = useFlash();
  const [query, setQuery] = useState<PropertyFilterProps.Query>(EMPTY_QUERY);
  const [type, setType] = useState(TYPES[0]);
  const [policy, setPolicy] = useState(POLICIES[0]);
  const [alias, setAlias] = useState(ALIASES[0]);
  const [pageIdx, setPageIdx] = useState(1);
  const [prefs, setPrefs] = useState<CollectionPreferencesProps.Preferences>({
    pageSize: 10, wrapLines: true, contentDisplay: COLUMNS.map((c) => ({ id: c.id, visible: true })),
  });
  const [data, setData] = useState<Page<DnsRecord> | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<DnsRecord[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState<DnsRecord | null>(null);

  const filter = useMemo(() => queryToParams(query), [query]);
  const pageSize = prefs.pageSize ?? 10;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.records.list(zone.id, { ...filter, type: type.value, routing_policy: policy.value, alias: alias.value, page: pageIdx, page_size: pageSize }));
    } catch (e) { notify("error", (e as Error).message); }
    finally { setLoading(false); }
  }, [zone.id, filter, type.value, policy.value, alias.value, pageIdx, pageSize, notify]);
  useEffect(() => { load(); }, [load]);

  const total = data?.total ?? 0;
  const resetPaging = () => { setPageIdx(1); setSelected([]); setEditing(null); };
  const filtered = filter.f.length > 0 || !!(type.value || policy.value || alias.value);

  const defs: TableProps.ColumnDefinition<DnsRecord>[] = [
    { id: "name", header: "Record name", minWidth: 180, cell: (r) => r.name },
    { id: "type", header: "Type", width: 90, cell: (r) => r.type },
    { id: "routing", header: "Routing policy", cell: (r) => r.routing_policy },
    { id: "diff", header: "Differentiator", cell: () => "-" },
    { id: "alias", header: "Alias", width: 90, cell: (r) => (r.alias ? "Yes" : "No") },
    { id: "value", header: "Value/Route traffic to", minWidth: 240, cell: (r) => (r.alias ? r.alias_target : r.values.map((v, i) => <div key={i} style={{ overflowWrap: "anywhere" }}>{v}</div>)) },
    { id: "ttl", header: "TTL (seconds)", width: 130, cell: (r) => (r.alias ? "-" : r.ttl) },
    { id: "hc", header: "Health check ID", cell: () => "-" },
    { id: "eth", header: "Evaluate target health", cell: (r) => (r.alias ? "No" : "-") },
  ];

  return (
    <>
      <Table
        variant="container"
        stickyHeader
        trackBy="id"
        selectionType="multi"
        selectedItems={selected}
        onSelectionChange={({ detail }) => { setSelected(detail.selectedItems); if (editing && !(detail.selectedItems.length === 1 && detail.selectedItems[0].id === editing.id)) setEditing(null); }}
        loading={loading}
        loadingText="Loading records"
        items={data?.items ?? []}
        columnDefinitions={defs}
        columnDisplay={prefs.contentDisplay}
        wrapLines={prefs.wrapLines}
        ariaLabels={{ selectionGroupLabel: "Records selection", itemSelectionLabel: (_, i) => `Select ${i.name} ${i.type}`, allItemsSelectionLabel: () => "Select all records" }}
        header={
          <Header
            counter={`(${total})`}
            info={<Link variant="info">Info</Link>}
            description="Automatic mode is the current search behavior optimized for best filter results. To change modes go to settings."
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button disabled={!selected.length || selected.some(isSystem)} onClick={() => setDeleting(true)}>Delete record</Button>
                <Button onClick={() => router.push(`${zoneUrl(zone.id)}/import`)}>Import zone file</Button>
                <Button disabled={selected.length !== 1} onClick={() => setEditing(selected[0])}>Edit record</Button>
                <Button variant="primary" onClick={() => router.push(`${zoneUrl(zone.id)}/create-record`)}>Create record</Button>
              </SpaceBetween>
            }
          >
            Records
          </Header>
        }
        filter={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div style={{ flex: "1 1 320px", minWidth: 240 }}>
              <PropertyFilter
                query={query}
                onChange={({ detail }) => { setQuery(detail); resetPaging(); }}
                filteringProperties={FILTER_PROPS}
                filteringPlaceholder="Filter records by property or value"
                countText={`${total} ${total === 1 ? "match" : "matches"}`}
                i18nStrings={{ filteringAriaLabel: "Filter records", filteringPlaceholder: "Filter records by property or value", clearFiltersText: "Clear filters", cancelActionText: "Cancel", applyActionText: "Apply", operationAndText: "and", operationOrText: "or", operatorContainsText: "Contains", operatorEqualsText: "Equals", operatorsText: "Operators", propertyText: "Property", valueText: "Value", allPropertiesLabel: "All properties", groupPropertiesText: "Properties", groupValuesText: "Values", editTokenHeader: "Edit filter", removeTokenButtonAriaLabel: () => "Remove filter", enteredTextLabel: (t) => `Use: "${t}"` }}
              />
            </div>
            <div style={{ width: 170 }}><Select ariaLabel="Filter by type" selectedOption={type} options={TYPES} onChange={({ detail }) => { setType(detail.selectedOption as typeof TYPES[number]); resetPaging(); }} /></div>
            <div style={{ width: 200 }}><Select ariaLabel="Filter by routing policy" selectedOption={policy} options={POLICIES} onChange={({ detail }) => { setPolicy(detail.selectedOption as typeof POLICIES[number]); resetPaging(); }} /></div>
            <div style={{ width: 150 }}><Select ariaLabel="Filter by alias" selectedOption={alias} options={ALIASES} onChange={({ detail }) => { setAlias(detail.selectedOption as typeof ALIASES[number]); resetPaging(); }} /></div>
          </div>
        }
        pagination={<Pagination currentPageIndex={pageIdx} pagesCount={Math.max(1, Math.ceil(total / pageSize))} onChange={({ detail }) => { setPageIdx(detail.currentPageIndex); setSelected([]); }} />}
        preferences={
          <CollectionPreferences
            title="Preferences" confirmLabel="Confirm" cancelLabel="Cancel"
            preferences={prefs} onConfirm={({ detail }) => { setPrefs(detail); setPageIdx(1); }}
            pageSizePreference={{ title: "Page size", options: [10, 20, 50, 100].map((v) => ({ value: v, label: `${v} records` })) }}
            wrapLinesPreference={{ label: "Wrap lines", description: "Select to see all the text and wrap the lines" }}
            contentDisplayPreference={{ title: "Column preferences", description: "Customize the columns visibility and order.", options: COLUMNS.map((c) => ({ ...c, alwaysVisible: c.id === "name" })) }}
          />
        }
        empty={
          <Box textAlign="center" color="inherit" padding={{ vertical: "l" }}>
            <SpaceBetween size="m">
              <div><Box variant="strong" color="inherit">{filtered ? "No matches" : "No records"}</Box><Box color="inherit">{filtered ? "We can't find a match." : "No records to display."}</Box></div>
              {!filtered && <Button onClick={() => router.push(`${zoneUrl(zone.id)}/create-record`)}>Create record</Button>}
            </SpaceBetween>
          </Box>
        }
      />

      {editing && (
        <EditRecordPanel
          zoneId={zone.id} zoneName={zone.name} record={editing} onClose={() => setEditing(null)}
          onSaved={(r) => { setEditing(null); setSelected([]); notify("success", `Successfully edited record ${r.name}.`); load(); onChanged(); }}
        />
      )}
      {deleting && (
        <DeleteRecordsModal
          zoneId={zone.id} records={selected} onClose={() => setDeleting(false)}
          onDeleted={() => { notify("success", selected.length === 1 ? `Successfully deleted record ${selected[0].name}.` : `Successfully deleted ${selected.length} records.`); setDeleting(false); setSelected([]); setEditing(null); setPageIdx(1); load(); onChanged(); }}
        />
      )}
    </>
  );
}

function DeleteRecordsModal({ zoneId, records, onClose, onDeleted }: { zoneId: string; records: DnsRecord[]; onClose: () => void; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function confirm() {
    setBusy(true); setErr("");
    try { await api.records.remove(zoneId, records.map((r) => r.id)); onDeleted(); }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  const many = records.length > 1;
  return (
    <Modal
      visible onDismiss={onClose} size="large" header={many ? "Delete records" : "Delete record"}
      footer={<Box float="right"><SpaceBetween direction="horizontal" size="xs">
        <Button variant="link" onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={busy} onClick={confirm}>Delete</Button>
      </SpaceBetween></Box>}
    >
      <SpaceBetween size="m">
        {err && <Alert type="error">{err}</Alert>}
        <Box>Are you sure you want to delete {many ? `these ${records.length} records` : "this record"}? This can&apos;t be undone.</Box>
        <Table
          variant="embedded" items={records} trackBy="id" stripedRows
          columnDefinitions={[
            { id: "n", header: "Record name", cell: (r) => r.name },
            { id: "t", header: "Type", cell: (r) => r.type },
            { id: "v", header: "Value/Route traffic to", cell: (r) => (r.alias ? r.alias_target : r.values.map((v, i) => <div key={i}>{v}</div>)) },
            { id: "l", header: "TTL (seconds)", cell: (r) => (r.alias ? "-" : r.ttl) },
          ]}
        />
      </SpaceBetween>
    </Modal>
  );
}
