"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Tiles from "@cloudscape-design/components/tiles";
import TileArt from "@/components/TileArt";
import { usePageMeta } from "@/components/PageMeta";
import { ZONES } from "@/lib/copy";

const R = "/route53/v2";
const OPTIONS = [
  { value: "register", label: "Register a domain", description: "Register the name, such as example.com, that your users use to access your application.", kind: "domain", href: `${R}/registereddomains` },
  { value: "transfer", label: "Transfer domain", description: "You can transfer domain names to Route 53 that you registered with another domain registrar.", kind: "transfer", href: `${R}/registereddomains` },
  { value: "zones", label: "Create hosted zones", description: "A hosted zone tells Route 53 how to respond to DNS queries for a domain such as example.com.", kind: "zones", href: `${ZONES}/create` },
  { value: "health", label: "Configure health checks", description: "Health checks monitor your applications and web resources, and direct DNS queries to healthy resources.", kind: "health", href: `${R}/healthchecks` },
  { value: "flow", label: "Configure traffic flow", description: "A visual tool that lets you easily create policies for multiple endpoints in complex configurations.", kind: "flow", href: `${R}/trafficpolicies` },
  { value: "resolver", label: "Configure resolvers", description: "A regional service that lets you route DNS queries between your VPCs and your network.", kind: "resolver", href: `${R}/resolver` },
] as const;

export default function GetStarted() {
  const router = useRouter();
  const [selected, setSelected] = useState<string>("register");
  usePageMeta({ breadcrumbs: [{ text: "Get started", href: `${R}/getstarted` }] });
  const target = OPTIONS.find((o) => o.value === selected)!;

  return (
    <SpaceBetween size="l">
      <Header variant="h1" info={<Link variant="info">Info</Link>}>Get started</Header>
      <Container header={<Header variant="h2">Choose your starting point</Header>}>
        <Tiles
          value={selected}
          onChange={({ detail }) => setSelected(detail.value)}
          columns={3}
          items={OPTIONS.map((o) => ({ value: o.value, label: o.label, description: o.description, image: <TileArt kind={o.kind} /> }))}
        />
      </Container>
      <Box float="right">
        <SpaceBetween size="l" direction="horizontal" alignItems="center">
          <Link href={`${R}/home`} onFollow={(e) => { e.preventDefault(); router.push(`${R}/home`); }}>Cancel</Link>
          <Button variant="primary" onClick={() => router.push(target.href)}>Get started</Button>
        </SpaceBetween>
      </Box>
    </SpaceBetween>
  );
}
