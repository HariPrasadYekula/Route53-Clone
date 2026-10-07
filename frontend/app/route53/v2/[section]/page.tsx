"use client";
import { useParams } from "next/navigation";
import Box from "@cloudscape-design/components/box";
import Container from "@cloudscape-design/components/container";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { usePageMeta } from "@/components/PageMeta";

const TITLES: Record<string, string> = {
  dashboard: "Dashboard", healthchecks: "Health checks", profiles: "Profiles",
  cidrcollections: "CIDR collections", trafficpolicies: "Traffic policies", policyrecords: "Policy records",
  registereddomains: "Registered domains", pendingrequests: "Pending requests",
  resolver: "Resolver", "resolver-vpcs": "Resolver VPCs", "resolver-inbound": "Inbound endpoints",
  "resolver-outbound": "Outbound endpoints", "resolver-rules": "Resolver rules", "resolver-query-logging": "Query logging",
  "dns-firewall-rule-groups": "DNS Firewall rule groups", "dns-firewall-domain-lists": "DNS Firewall domain lists",
};

export default function ComingSoon() {
  const { section } = useParams<{ section: string }>();
  const title = TITLES[section] ?? "Page not found";
  usePageMeta({ breadcrumbs: [{ text: title, href: `/route53/v2/${section}` }] });
  const known = section in TITLES;
  return (
    <ContentLayout header={<Header variant="h1">{title}</Header>}>
      <Container>
        <Box textAlign="center" padding={{ vertical: "xxl" }}>
          <SpaceBetween size="xs">
            <Box variant="h2" color="text-body-secondary">{known ? "Coming soon" : "This page doesn't exist"}</Box>
            <Box color="text-body-secondary">{known ? `${title} isn't available in this Route 53 clone yet.` : "Check the URL or use the navigation menu."}</Box>
          </SpaceBetween>
        </Box>
      </Container>
    </ContentLayout>
  );
}
