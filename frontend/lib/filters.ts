import type { PropertyFilterProps } from "@cloudscape-design/components/property-filter";
import type { FilterParams } from "./api";

export const EMPTY_QUERY: PropertyFilterProps.Query = { tokens: [], operation: "and" };

/** Turn the property-filter tokens into the `f=<property>:<text>` params the API understands. */
export function queryToParams(query: PropertyFilterProps.Query): FilterParams {
  const f = query.tokens
    .map((t) => ({ key: t.propertyKey ?? "all", text: String(t.value ?? "").trim() }))
    .filter((t) => t.text)
    .map((t) => `${t.key}:${t.text}`);
  return { f, op: query.operation };
}
