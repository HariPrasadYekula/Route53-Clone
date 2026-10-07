"use client";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import Pagination from "@cloudscape-design/components/pagination";
import PropertyFilter, { PropertyFilterProps } from "@cloudscape-design/components/property-filter";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Table from "@cloudscape-design/components/table";
import { useFlash } from "@/components/FlashProvider";
import { DeleteZoneModal, EditZoneModal } from "@/components/ZoneModals";
import { usePageMeta } from "@/components/PageMeta";
import { api } from "@/lib/api";
import { EMPTY_QUERY, queryToParams } from "@/lib/filters";
import { COPY, ZONES, zoneUrl } from "@/lib/copy";
import type { Page, Zone } from "@/lib/types";

const PAGE_SIZE = 10;
const FILTER_PROPS: PropertyFilterProps.FilteringProperty[] = [
  { key: "name", propertyLabel: "Hosted zone name", groupValuesLabel: "Hosted zone name values", operators: [":"] },
  { key: "type", propertyLabel: "Type", groupValuesLabel: "Type values", operators: [":"] },
  { key: "id", propertyLabel: "Hosted zone ID", groupValuesLabel: "Hosted zone ID values", operators: [":"] },
  { key: "description", propertyLabel: "Description", groupValuesLabel: "Description values", operators: [":"] },
];

export default function HostedZonesPage() {
  // useSearchParams needs a Suspense boundary so the page can still be prerendered.
  return <Suspense fallback={null}><HostedZones /></Suspense>;
}

function HostedZones() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const notify = useFlash();
  usePageMeta({ breadcrumbs: [{ text: "Hosted zones", href: ZONES }] });

  const [query, setQuery] = useState<PropertyFilterProps.Query>(EMPTY_QUERY);
  const [pageIdx, setPageIdx] = useState(1);
  const [data, setData] = useState<Page<Zone> | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Zone[]>([]);
  const [modal, setModal] = useState<"delete" | "edit" | null>(null);

  // The search box in the top bar sends people here with ?search=<text>.
  const search = searchParams?.get("search") ?? "";
  const searchStamp = searchParams?.get("t") ?? "";
  useEffect(() => {
    if (!search) return;
    setQuery({ tokens: [{ value: search, operator: ":" }], operation: "and" });
    setPageIdx(1); setSelected([]);
  }, [search, searchStamp]);

  const filter = useMemo(() => queryToParams(query), [query]);
  const filtered = filter.f.length > 0;

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await api.zones.list({ ...filter, page: pageIdx, page_size: PAGE_SIZE })); }
    catch (e) { notify("error", (e as Error).message); }
    finally { setLoading(false); }
  }, [filter, pageIdx, notify]);
  useEffect(() => { load(); }, [load]);

  const zone = selected[0];
  const total = data?.total ?? 0;

  return (
    <>
      <Table
        variant="container"
        stickyHeader
        trackBy="id"
        selectionType="single"
        selectedItems={selected}
        onSelectionChange={({ detail }) => setSelected(detail.selectedItems)}
        loading={loading}
        loadingText="Loading hosted zones"
        items={data?.items ?? []}
        ariaLabels={{ selectionGroupLabel: "Hosted zone selection", itemSelectionLabel: (_, i) => `Select ${i.name}`, allItemsSelectionLabel: () => "Select" }}
        columnDefinitions={[
          { id: "name", header: "Hosted zone name", cell: (z) => <Link href={zoneUrl(z.id)} onFollow={(e) => { e.preventDefault(); router.push(zoneUrl(z.id)); }}>{z.name}</Link>, minWidth: 200 },
          { id: "type", header: "Type", cell: (z) => (z.type === "public" ? "Public" : "Private"), width: 110 },
          { id: "created_by", header: "Created by", cell: (z) => z.created_by, width: 130 },
          { id: "record_count", header: "Record count", cell: (z) => z.record_count, width: 130 },
          { id: "description", header: "Description", cell: (z) => z.description || "-" },
          { id: "id", header: "Hosted zone ID", cell: (z) => z.id, minWidth: 170 },
        ]}
        header={
          <Header
            counter={`(${total})`}
            info={<Link variant="info">Info</Link>}
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="icon" iconName="refresh" ariaLabel="Refresh hosted zones" onClick={load} loading={loading} />
                <Button disabled={!zone} onClick={() => router.push(zoneUrl(zone.id))}>View details</Button>
                <Button disabled={!zone} onClick={() => setModal("edit")}>Edit</Button>
                <Button disabled={!zone} onClick={() => setModal("delete")}>Delete</Button>
                <Button variant="primary" onClick={() => router.push(`${ZONES}/create`)}>Create hosted zone</Button>
              </SpaceBetween>
            }
          >
            Hosted zones
          </Header>
        }
        filter={
          <PropertyFilter
            query={query}
            onChange={({ detail }) => { setQuery(detail); setPageIdx(1); setSelected([]); }}
            filteringProperties={FILTER_PROPS}
            filteringOptions={[{ propertyKey: "type", value: "public", label: "public" }, { propertyKey: "type", value: "private", label: "private" }]}
            filteringPlaceholder="Filter hosted zones by property or value"
            countText={`${total} ${total === 1 ? "match" : "matches"}`}
            i18nStrings={{ filteringAriaLabel: "Filter hosted zones", filteringPlaceholder: "Filter hosted zones by property or value", clearFiltersText: "Clear filters", cancelActionText: "Cancel", applyActionText: "Apply", operationAndText: "and", operationOrText: "or", operatorContainsText: "Contains", operatorEqualsText: "Equals", operatorsText: "Operators", propertyText: "Property", valueText: "Value", allPropertiesLabel: "All properties", groupPropertiesText: "Properties", groupValuesText: "Values", editTokenHeader: "Edit filter", removeTokenButtonAriaLabel: () => "Remove filter", enteredTextLabel: (t) => `Use: "${t}"` }}
          />
        }
        pagination={<Pagination currentPageIndex={pageIdx} pagesCount={Math.max(1, Math.ceil(total / PAGE_SIZE))} onChange={({ detail }) => setPageIdx(detail.currentPageIndex)} />}
        empty={
          <Box textAlign="center" color="inherit" padding={{ vertical: "l" }}>
            <SpaceBetween size="m">
              <div><Box variant="strong" color="inherit">{filtered ? "No matches" : COPY.zonesEmptyTitle}</Box><Box color="inherit">{filtered ? "We can't find a match." : COPY.zonesEmptyBody}</Box></div>
              {!filtered && <Button variant="primary" onClick={() => router.push(`${ZONES}/create`)}>Create hosted zone</Button>}
            </SpaceBetween>
          </Box>
        }
      />
      {zone && modal === "delete" && (
        <DeleteZoneModal zone={zone} onClose={() => setModal(null)} onDeleted={() => { setModal(null); setSelected([]); notify("success", `Successfully deleted hosted zone ${zone.name}.`); load(); }} />
      )}
      {zone && modal === "edit" && (
        <EditZoneModal zone={zone} onClose={() => setModal(null)} onSaved={() => { setModal(null); setSelected([]); notify("success", `Successfully edited hosted zone ${zone.name}.`); load(); }} />
      )}
    </>
  );
}
