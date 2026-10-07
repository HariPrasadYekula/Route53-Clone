"use client";
import { useRouter } from "next/navigation";
import Button from "@cloudscape-design/components/button";
import Link from "@cloudscape-design/components/link";
import { usePageMeta } from "@/components/PageMeta";

export default function Home() {
  const router = useRouter();
  usePageMeta({ breadcrumbs: [], fullBleed: true });
  return (
    <>
      <section className="hero">
        <div className="hero-grid">
          <div>
            <small>Network &amp; Content Delivery</small>
            <h1>Amazon Route 53</h1>
            <h2>A reliable way to route users to internet applications</h2>
            <p>Amazon Route 53 is a highly available and scalable cloud Domain Name System (DNS) web service.</p>
          </div>
          <div className="hero-cards">
            <div className="hero-card">
              <h3>Get started with Route 53</h3>
              <p style={{ color: "#0f141a", margin: "0 0 24px" }}>Get started by registering a domain, configuring DNS, or using another Route 53 feature.</p>
              <Button variant="primary" onClick={() => router.push("/route53/v2/getstarted")}>Get started</Button>
            </div>
            <div className="hero-card">
              <h3>Pricing (US)</h3>
              <Link external href="#">View pricing</Link>
            </div>
          </div>
        </div>
      </section>
      <section className="how">
        <div>
          <h2 style={{ fontSize: 28, margin: "0 0 16px" }}>How it works</h2>
          <div className="video" role="img" aria-label="Amazon Route 53 overview video">
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 700 }}>Amazon Route 53</div>
              <div style={{ opacity: 0.8, marginBottom: 14 }}>Amazon Web Services</div>
              <div style={{ width: 64, height: 44, background: "#f00", borderRadius: 12, margin: "0 auto", display: "grid", placeItems: "center" }}>▶</div>
            </div>
          </div>
        </div>
        <div className="hero-card" style={{ border: "1px solid #e9ebed", alignSelf: "start", marginTop: 52 }}>
          <h3>More resources</h3>
          {["Documentation", "API reference", "FAQs"].map((t) => (
            <div key={t} style={{ padding: "10px 0", borderTop: "1px solid #e9ebed" }}><Link href="#">{t}</Link></div>
          ))}
        </div>
      </section>
    </>
  );
}
