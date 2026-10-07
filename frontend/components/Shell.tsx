"use client";
import { ReactNode, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import AppLayout from "@cloudscape-design/components/app-layout";
import BreadcrumbGroup from "@cloudscape-design/components/breadcrumb-group";
import HelpPanel from "@cloudscape-design/components/help-panel";
import Input from "@cloudscape-design/components/input";
import Link from "@cloudscape-design/components/link";
import SideNavigation from "@cloudscape-design/components/side-navigation";
import Spinner from "@cloudscape-design/components/spinner";
import TopNavigation from "@cloudscape-design/components/top-navigation";
import Modal from "@cloudscape-design/components/modal";
import Box from "@cloudscape-design/components/box";
import { applyMode, Mode } from "@cloudscape-design/global-styles";
import { useAuth } from "./AuthProvider";
import { FlashItems } from "./FlashProvider";
import { Meta, MetaCtx } from "./PageMeta";
import { COPY, ROUTE53_HOME, ZONES } from "@/lib/copy";

const R = "/route53/v2";
const TERMINAL = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="2" width="14" height="12" rx="1.5"/><path d="M4.5 6l2.5 2-2.5 2M8.5 10.5h3" stroke-linecap="round"/></svg>`;
const fmtId = (id: string) => id.replace(/(\d{4})(?=\d)/g, "$1-");

export default function Shell({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [meta, setMeta] = useState<Meta>({ breadcrumbs: [] });
  const [navOpen, setNavOpen] = useState(() => !pathname.endsWith("/home"));
  const [q, setQ] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const [dark, setDark] = useState(false);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    let saved = false;
    try { saved = localStorage.getItem("r53-theme") === "dark"; } catch {}
    setDark(saved); applyMode(saved ? Mode.Dark : Mode.Light);
  }, []);
  const toggleDark = () => {
    const next = !dark; setDark(next); applyMode(next ? Mode.Dark : Mode.Light);
    try { localStorage.setItem("r53-theme", next ? "dark" : "light"); } catch {}
  };

  useEffect(() => { if (!loading && !user) router.replace("/login"); }, [loading, user, router]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /input|textarea|select/i.test((e.target as HTMLElement)?.tagName ?? "");
      if (e.altKey && e.key.toLowerCase() === "s") { e.preventDefault(); searchRef.current?.focus(); }
      else if (e.altKey && e.key.toLowerCase() === "h") { e.preventDefault(); router.push(ZONES); }
      else if (e.altKey && e.key.toLowerCase() === "d") { e.preventDefault(); toggleDark(); }
      else if (!typing && e.key === "?") { e.preventDefault(); setHelp(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dark, router]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading || !user) {
    return <div style={{ display: "grid", placeItems: "center", height: "100vh" }}><Spinner size="large" /></div>;
  }

  const go = (href: string) => router.push(href);
  const active = pathname.startsWith(ZONES) ? ZONES : pathname;

  return (
    <MetaCtx.Provider value={setMeta}>
      <div id="h" style={{ position: "sticky", top: 0, zIndex: 1002 }}>
        <TopNavigation
          identity={{ href: ROUTE53_HOME, logo: { src: "/aws-logo.svg", alt: "AWS" }, onFollow: (e) => { e.preventDefault(); go(ROUTE53_HOME); } }}
          search={
            <Input
              ref={searchRef} type="search" placeholder="Search hosted zones" ariaLabel="Search hosted zones" value={q}
              onChange={({ detail }) => setQ(detail.value)}
              onKeyDown={({ detail }) => { if (detail.key === "Enter" && q.trim()) go(`${ZONES}?search=${encodeURIComponent(q.trim())}&t=${Date.now()}`); }}
            />
          }
          utilities={[
            { type: "button", iconSvg: <span dangerouslySetInnerHTML={{ __html: TERMINAL }} />, ariaLabel: "CloudShell", title: "CloudShell" },
            { type: "button", iconName: "notification", ariaLabel: "Notifications", title: "Notifications" },
            { type: "button", iconName: "status-info", ariaLabel: "Support", title: "Support" },
            {
              type: "menu-dropdown", iconName: "settings", ariaLabel: "Settings", title: "Settings",
              items: [
                { id: "theme", text: dark ? "Switch to light mode" : "Switch to dark mode" },
                { id: "shortcuts", text: "Keyboard shortcuts" },
              ],
              onItemClick: ({ detail }) => { if (detail.id === "theme") toggleDark(); else setHelp(true); },
            },
            { type: "menu-dropdown", text: "US East (N. Virginia)", items: [{ id: "region", text: "US East (N. Virginia)" }, { id: "region2", text: "Asia Pacific (Hyderabad)" }, { id: "region3", text: "Europe (Ireland)" }] },
            {
              type: "menu-dropdown",
              text: `${user.account_name} (${fmtId(user.account_id)})`,
              description: user.username,
              iconName: "user-profile",
              items: [
                { id: "account", text: "Account" },
                { id: "billing", text: "Billing and Cost Management" },
                { id: "security", text: "Security credentials" },
                { id: "signout", text: "Sign out" },
              ],
              onItemClick: async ({ detail }) => { if (detail.id === "signout") { await logout(); router.replace("/login"); } },
            },
          ]}
          i18nStrings={{ searchIconAriaLabel: "Search", searchDismissIconAriaLabel: "Close search", overflowMenuTriggerText: "More", overflowMenuTitleText: "All", overflowMenuBackIconAriaLabel: "Back", overflowMenuDismissIconAriaLabel: "Close menu" }}
        />

      </div>

      <AppLayout
        headerSelector="#h"
        footerSelector="#f"
        navigationOpen={navOpen}
        onNavigationChange={({ detail }) => setNavOpen(detail.open)}
        navigation={
          <SideNavigation
            activeHref={active}
            header={{ text: "Route 53", href: ROUTE53_HOME }}
            onFollow={(e) => { e.preventDefault(); go(e.detail.href); }}
            items={[
              { type: "link", text: "Dashboard", href: `${R}/dashboard` },
              { type: "link", text: "Hosted zones", href: ZONES },
              { type: "link", text: "Health checks", href: `${R}/healthchecks` },
              { type: "link", text: "Profiles", href: `${R}/profiles` },
              { type: "section", text: "IP-based routing", defaultExpanded: true, items: [{ type: "link", text: "CIDR collections", href: `${R}/cidrcollections` }] },
              { type: "section", text: "Traffic flow", defaultExpanded: true, items: [
                { type: "link", text: "Traffic policies", href: `${R}/trafficpolicies` },
                { type: "link", text: "Policy records", href: `${R}/policyrecords` },
              ] },
              { type: "section", text: "Domains", defaultExpanded: true, items: [
                { type: "link", text: "Registered domains", href: `${R}/registereddomains` },
                { type: "link", text: "Pending requests", href: `${R}/pendingrequests` },
              ] },
              { type: "section", text: "Resolver", defaultExpanded: true, items: [
                { type: "link", text: "VPCs", href: `${R}/resolver-vpcs` },
                { type: "link", text: "Inbound endpoints", href: `${R}/resolver-inbound` },
                { type: "link", text: "Outbound endpoints", href: `${R}/resolver-outbound` },
                { type: "link", text: "Rules", href: `${R}/resolver-rules` },
                { type: "link", text: "Query logging", href: `${R}/resolver-query-logging` },
              ] },
              { type: "section", text: "DNS Firewall", defaultExpanded: true, items: [
                { type: "link", text: "Rule groups", href: `${R}/dns-firewall-rule-groups` },
                { type: "link", text: "Domain lists", href: `${R}/dns-firewall-domain-lists` },
              ] },
            ]}
          />
        }
        breadcrumbs={
          meta.breadcrumbs.length ? (
            <BreadcrumbGroup
              items={[{ text: "Route 53", href: ROUTE53_HOME }, ...meta.breadcrumbs]}
              onFollow={(e) => { e.preventDefault(); go(e.detail.href); }}
            />
          ) : undefined
        }
        notifications={<FlashItems />}
        disableContentPaddings={meta.fullBleed}
        toolsHide={false}
        tools={<HelpPanel header={<h2>Route 53</h2>}><p>Amazon Route 53 is a highly available and scalable cloud Domain Name System (DNS) web service.</p></HelpPanel>}
        content={children}
      />

      {help && <Modal visible onDismiss={() => setHelp(false)} header="Keyboard shortcuts" footer={<Box float="right"><button className="plain-btn" onClick={() => setHelp(false)}>Close</button></Box>}>
        <table className="kbd-table"><tbody>
          {[["Alt + S", "Focus the search box"], ["Alt + H", "Go to Hosted zones"], ["Alt + D", "Toggle dark mode"], ["?", "Show this dialog"], ["Esc", "Close the Edit record pane or a dialog"]].map(([k, d]) => (
            <tr key={k}><td><kbd>{k}</kbd></td><td>{d}</td></tr>
          ))}
        </tbody></table>
      </Modal>}

      <footer id="f">
        <div className="group"><button>CloudShell</button><button>Feedback</button><button>Console Mobile App</button></div>
        <div className="group"><span>{COPY.footerCopyright}</span><a href="#">Privacy</a><a href="#">Terms</a><a href="#">Cookie preferences</a></div>
      </footer>
    </MetaCtx.Provider>
  );
}
