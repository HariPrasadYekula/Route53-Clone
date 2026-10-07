export interface User { username: string; account_name: string; account_id: string }
export interface Zone {
  id: string; name: string; type: "public" | "private"; description: string; created_by: string;
  created_at: string; record_count: number; vpc_id: string | null; vpc_region: string | null; name_servers?: string[];
}
export interface DnsRecord {
  id: number; zone_id: string; name: string; type: string; ttl: number; values: string[];
  routing_policy: string; alias: boolean; alias_target: string | null; created_at: string; updated_at: string;
}
export interface Page<T> { items: T[]; total: number; page: number; page_size: number }
export interface Tag { key: string; value: string }
export interface RecordInput { name: string; type: string; ttl: number; values: string[]; routing_policy?: string; alias_target?: string | null }
export interface TestResult { response_code: string; record_name: string; record_type: string; protocol: string; ttl?: number; answers: string[] }
