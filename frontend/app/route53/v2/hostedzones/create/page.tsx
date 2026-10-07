"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import Input from "@cloudscape-design/components/input";
import Link from "@cloudscape-design/components/link";
import Alert from "@cloudscape-design/components/alert";
import Select from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useFlash } from "@/components/FlashProvider";
import { usePageMeta } from "@/components/PageMeta";
import { ApiError, api } from "@/lib/api";
import { ZONES, zoneUrl } from "@/lib/copy";
import type { Tag } from "@/lib/types";

const TYPES = [
  { value: "public", label: "Public hosted zone", description: "A public hosted zone determines how traffic is routed on the internet." },
  { value: "private", label: "Private hosted zone", description: "A private hosted zone determines how traffic is routed within an Amazon VPC." },
];

const REGIONS = [
  { value: "us-east-1", label: "US East (N. Virginia)" },
  { value: "ap-south-2", label: "Asia Pacific (Hyderabad)" },
  { value: "eu-west-1", label: "Europe (Ireland)" },
];

export default function CreateZone() {
  const router = useRouter();
  const notify = useFlash();
  usePageMeta({ breadcrumbs: [{ text: "Hosted zones", href: ZONES }, { text: "Create hosted zone", href: `${ZONES}/create` }] });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState(TYPES[0]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [vpcId, setVpcId] = useState("vpc-0a1b2c3d4e5f67890");
  const [vpcRegion, setVpcRegion] = useState("us-east-1");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true); setErrors({});
    try {
      const priv = type.value === "private";
      const z = await api.zones.create({
        name, description, type: type.value, tags: tags.filter((t) => t.key.trim()),
        ...(priv ? { vpc_id: vpcId, vpc_region: vpcRegion } : {}),
      });
      notify("success", `Successfully created hosted zone ${z.name}.`);
      router.push(zoneUrl(z.id));
    } catch (e) {
      if (e instanceof ApiError && e.field) setErrors({ [e.field]: e.message });
      else notify("error", (e as Error).message);
      setBusy(false);
    }
  }
  const setTag = (i: number, patch: Partial<Tag>) => setTags((ts) => ts.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  return (
    <Form
      header={<Header variant="h1" info={<Link variant="info">Info</Link>} description="A hosted zone is a container for records, and records contain information about how you want to route traffic for a specific domain, such as example.com, and its subdomains.">Create hosted zone</Header>}
      actions={
        <SpaceBetween direction="horizontal" size="xs">
          <Button variant="link" onClick={() => router.push(ZONES)}>Cancel</Button>
          <Button variant="primary" loading={busy} onClick={submit}>Create hosted zone</Button>
        </SpaceBetween>
      }
    >
      <SpaceBetween size="l">
        <Container header={<Header variant="h2" info={<Link variant="info">Info</Link>}>Hosted zone configuration</Header>}>
          <SpaceBetween size="l">
            <FormField label="Domain name" info={<Link variant="info">Info</Link>} description="This is the name of the domain that you want to route traffic for." errorText={errors.name} constraintText="Valid characters: a-z, 0-9, and - (hyphen).">
              <Input value={name} onChange={({ detail }) => setName(detail.value)} placeholder="example.com" invalid={!!errors.name} />
            </FormField>
            <FormField label={<>Description <i>- optional</i></>} description="This value lets you distinguish hosted zones that have the same name." errorText={errors.description} constraintText="The description can have up to 256 characters.">
              <Input value={description} onChange={({ detail }) => setDescription(detail.value)} placeholder="The hosted zone is used for..." />
            </FormField>
            <FormField label="Type" info={<Link variant="info">Info</Link>} description="The type indicates whether you want to route traffic on the internet or in an Amazon VPC.">
              <Select selectedOption={type} onChange={({ detail }) => setType(detail.selectedOption as typeof TYPES[number])} options={TYPES} selectedAriaLabel="Selected" />
            </FormField>
          </SpaceBetween>
          {type.value === "private" && (
            <Container header={<Header variant="h2" info={<Link variant="info">Info</Link>}>VPC association</Header>}>
              <SpaceBetween size="m">
                <Alert type="info">Private hosted zones are associated with an Amazon VPC. This clone uses mocked VPC data; no AWS resources are changed.</Alert>
                <FormField label="VPC ID" description="Choose the VPC where this private hosted zone will be available." errorText={errors.vpc_id}>
                  <Input value={vpcId} invalid={!!errors.vpc_id} onChange={({ detail }) => setVpcId(detail.value)} />
                </FormField>
                <FormField label="Region" errorText={errors.vpc_region}>
                  <Select
                    selectedOption={REGIONS.find((r) => r.value === vpcRegion) ?? REGIONS[0]}
                    options={REGIONS}
                    onChange={({ detail }) => setVpcRegion(detail.selectedOption.value ?? vpcRegion)}
                  />
                </FormField>
              </SpaceBetween>
            </Container>
          )}
        </Container>
        <Container header={<Header variant="h2" info={<Link variant="info">Info</Link>}>Tags <i>- optional</i></Header>}>
          <SpaceBetween size="s">
            {errors.tags && <Alert type="error">{errors.tags}</Alert>}
            {tags.length === 0 && <span>No tags associated with the resource.</span>}
            {tags.map((t, i) => (
              <SpaceBetween key={i} direction="horizontal" size="s" alignItems="end">
                <FormField label={i === 0 ? "Key" : undefined}><Input value={t.key} onChange={({ detail }) => setTag(i, { key: detail.value })} placeholder="Enter key" /></FormField>
                <FormField label={i === 0 ? "Value - optional" : undefined}><Input value={t.value} onChange={({ detail }) => setTag(i, { value: detail.value })} placeholder="Enter value" /></FormField>
                <Button onClick={() => setTags((ts) => ts.filter((_, j) => j !== i))}>Remove</Button>
              </SpaceBetween>
            ))}
            <Button onClick={() => setTags((ts) => [...ts, { key: "", value: "" }])}>Add tag</Button>
          </SpaceBetween>
        </Container>
      </SpaceBetween>
    </Form>
  );
}
