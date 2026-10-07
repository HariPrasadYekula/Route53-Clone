import os
import tempfile

os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp()}/test.db"

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        c.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
        yield c


def test_auth_required_and_login():
    with TestClient(app) as c:
        assert c.get("/api/hosted-zones").status_code == 401
        assert c.post("/api/auth/login", json={"username": "admin", "password": "bad"}).status_code == 401
        assert c.post("/api/auth/login", json={"username": "admin", "password": "admin123"}).status_code == 200
        assert c.get("/api/auth/me").json()["account_id"] == "123456789012"
        c.post("/api/auth/logout")
        assert c.get("/api/auth/me").status_code == 401


def test_seed_and_search(client):
    r = client.get("/api/hosted-zones").json()
    assert r["total"] == 5
    assert all(z["id"].startswith("Z") for z in r["items"])
    assert client.get("/api/hosted-zones?f=name:shop").json()["total"] == 1
    assert client.get("/api/hosted-zones?page=2&page_size=2").json()["items"][0]["name"]


def test_create_zone_adds_ns_soa_and_rejects_tld(client):
    r = client.post("/api/hosted-zones", json={"name": "Fresh.Dev.", "description": "x"})
    assert r.status_code == 201
    z = r.json()
    assert z["name"] == "fresh.dev" and z["record_count"] == 2 and len(z["name_servers"]) == 4
    assert client.post("/api/hosted-zones", json={"name": "com"}).status_code == 400
    assert client.post("/api/hosted-zones", json={"name": "fresh.dev"}).json()["error"]["code"] == "HostedZoneAlreadyExists"


def test_edit_zone_description_only(client):
    zid = client.get("/api/hosted-zones?f=name:fresh.dev").json()["items"][0]["id"]
    r = client.patch(f"/api/hosted-zones/{zid}", json={"description": "updated"})
    assert r.json()["description"] == "updated" and r.json()["name"] == "fresh.dev"


def test_record_crud_and_validation(client):
    zid = client.get("/api/hosted-zones?f=name:fresh.dev").json()["items"][0]["id"]
    base = f"/api/hosted-zones/{zid}/records"
    bad = client.post(base, json={"name": "www", "type": "A", "values": ["999.1.1.1"]})
    assert bad.status_code == 400 and bad.json()["error"]["field"] == "values"
    ok = client.post(base, json={"name": "www", "type": "A", "ttl": 60, "values": ["1.2.3.4"]})
    rec = ok.json()[0]
    assert ok.status_code == 201 and rec["name"] == "www.fresh.dev"
    dup = client.post(base, json={"name": "www", "type": "A", "values": ["1.2.3.4"]})
    assert "already exists" in dup.json()["error"]["message"]
    assert client.post(base, json={"name": "www", "type": "CNAME", "values": ["x.com"]}).status_code == 400
    upd = client.put(f"{base}/{rec['id']}", json={"name": "www", "type": "A", "ttl": 120, "values": ["5.6.7.8"]})
    assert upd.json()["ttl"] == 120 and upd.json()["values"] == ["5.6.7.8"]
    assert client.get(f"{base}?f=value:5.6.7.8").json()["total"] == 1
    assert client.get(f"{base}?type=A").json()["total"] == 1


def test_quick_create_is_atomic_and_all_types(client):
    zid = client.get("/api/hosted-zones?f=name:fresh.dev").json()["items"][0]["id"]
    base = f"/api/hosted-zones/{zid}/records"
    batch = [
        {"name": "m", "type": "MX", "values": ["10 mail.fresh.dev"]},
        {"name": "s", "type": "SRV", "values": ["1 2 3 srv.fresh.dev"]},
        {"name": "c", "type": "CAA", "values": ['0 issue "letsencrypt.org"']},
        {"name": "t", "type": "TXT", "values": ["hello world"]},
        {"name": "p", "type": "PTR", "values": ["host.fresh.dev"]},
        {"name": "v6", "type": "AAAA", "values": ["2001:db8::1"]},
    ]
    r = client.post(base, json=batch)
    assert r.status_code == 201 and len(r.json()) == 6
    assert [x for x in r.json() if x["type"] == "TXT"][0]["values"] == ['"hello world"']
    before = client.get(base).json()["total"]
    fail = client.post(base, json=[{"name": "ok1", "type": "A", "values": ["1.1.1.1"]}, {"name": "bad", "type": "A", "values": ["nope"]}])
    assert fail.status_code == 400 and client.get(base).json()["total"] == before


def test_delete_rules(client):
    zid = client.get("/api/hosted-zones?f=name:fresh.dev").json()["items"][0]["id"]
    base = f"/api/hosted-zones/{zid}/records"
    d = client.delete(f"/api/hosted-zones/{zid}")
    assert d.status_code == 400 and "non-required resource record sets" in d.json()["error"]["message"]
    rows = client.get(f"{base}?page_size=100").json()["items"]
    ns = [r for r in rows if r["type"] == "NS"][0]
    assert client.delete(f"{base}/{ns['id']}").status_code == 400
    ids = [r["id"] for r in rows if r["type"] not in ("NS", "SOA")]
    assert client.post(f"{base}/bulk-delete", json={"ids": ids}).json()["deleted"] == len(ids)
    assert client.delete(f"/api/hosted-zones/{zid}").status_code == 204
    assert client.get(f"/api/hosted-zones/{zid}").status_code == 404


def test_export(client):
    zid = client.get("/api/hosted-zones?f=name:example.com").json()["items"][0]["id"]
    assert "hosted_zone" in client.get(f"/api/hosted-zones/{zid}/export?format=json").json()
    assert "$ORIGIN" in client.get(f"/api/hosted-zones/{zid}/export?format=bind").text


def test_import_bind_zone_file(client):
    zid = client.post("/api/hosted-zones", json={"name": "imp.test"}).json()["id"]
    zf = """$ORIGIN imp.test.
$TTL 3600
@   IN SOA ns1.imp.test. admin.imp.test. ( 1 7200 900 1209600 86400 )
@   IN NS  ns1.imp.test.
@   IN A   192.0.2.1
www IN CNAME imp.test.
@   IN MX  10 mail
@   IN TXT "v=spf1 " "include:x.com ~all"
"""
    r = client.post(f"/api/hosted-zones/{zid}/records/import", json={"zone_file": zf})
    assert r.status_code == 201, r.text
    names = {(x["name"], x["type"]): x for x in r.json()["records"]}
    assert r.json()["imported"] == 4
    assert names[("imp.test", "MX")]["values"] == ["10 mail.imp.test"]
    assert names[("imp.test", "TXT")]["values"] == ['"v=spf1 include:x.com ~all"']
    again = client.post(f"/api/hosted-zones/{zid}/records/import", json={"zone_file": zf})
    assert again.status_code == 400 and "already exists" in again.json()["error"]["message"]
    bad = client.post(f"/api/hosted-zones/{zid}/records/import", json={"zone_file": "$INCLUDE x"})
    assert bad.status_code == 400


def test_alias_and_test_record(client):
    zid = client.post("/api/hosted-zones", json={"name": "alias.test"}).json()["id"]
    base = f"/api/hosted-zones/{zid}/records"
    r = client.post(base, json={"name": "app", "type": "A", "alias_target": "lb.example.net"})
    assert r.status_code == 201 and r.json()[0]["alias"] is True
    assert client.get(f"{base}?alias=true").json()["total"] == 1
    assert client.get(f"{base}?alias=false").json()["total"] == 2
    t = client.get(f"{base}/test?name=app&type=A").json()
    assert t["response_code"] == "NOERROR" and t["answers"] == ["lb.example.net"]
    assert client.get(f"{base}/test?name=nope&type=A").json()["response_code"] == "NXDOMAIN"


def test_signup_creates_isolated_account():
    with TestClient(app) as c:
        weak = c.post("/api/auth/signup", json={"username": "newbie", "password": "short"})
        assert weak.status_code == 422 and weak.json()["error"]["field"] == "password"
        bad_name = c.post("/api/auth/signup", json={"username": "no spaces", "password": "longenough1"})
        assert bad_name.status_code == 422 and bad_name.json()["error"]["field"] == "username"

        r = c.post("/api/auth/signup", json={"username": "Newbie", "password": "longenough1", "account_name": "Newbie Inc"})
        assert r.status_code == 201
        me = c.get("/api/auth/me").json()  # signup also signs the user in
        assert me["username"] == "Newbie" and me["account_name"] == "Newbie Inc" and len(me["account_id"]) == 12
        assert me["account_id"] != "123456789012"

        assert c.get("/api/hosted-zones").json()["total"] == 0  # does not see the demo account's zones
        admin_zone = TestClient(app)
        admin_zone.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
        admin_zid = admin_zone.get("/api/hosted-zones?f=name:example.com").json()["items"][0]["id"]
        assert c.get(f"/api/hosted-zones/{admin_zid}").status_code == 404
        assert c.get(f"/api/hosted-zones/{admin_zid}/records").status_code == 404
        assert c.delete(f"/api/hosted-zones/{admin_zid}").status_code == 404

        mine = c.post("/api/hosted-zones", json={"name": "example.com"})  # same name as admin's zone is fine
        assert mine.status_code == 201

        again = TestClient(app).post("/api/auth/signup", json={"username": "NEWBIE", "password": "longenough1"})
        assert again.status_code == 409 and again.json()["error"]["code"] == "UsernameAlreadyExists"


def test_login_account_field_and_single_session_logout():
    with TestClient(app) as a, TestClient(app) as b:
        wrong = a.post("/api/auth/login", json={"username": "admin", "password": "admin123", "account": "999999999999"})
        assert wrong.status_code == 401
        ok = a.post("/api/auth/login", json={"username": "ADMIN", "password": "admin123", "account": "1234-5678-9012"})
        assert ok.status_code == 200
        assert b.post("/api/auth/login", json={"username": "admin", "password": "admin123"}).status_code == 200
        assert a.post("/api/auth/logout").status_code == 204
        assert a.get("/api/auth/me").status_code == 401
        assert b.get("/api/auth/me").status_code == 200  # the other browser stays signed in


def test_filters_combine_with_and_or(client):
    zones_and = client.get("/api/hosted-zones?f=name:example&f=description:API").json()
    assert [z["name"] for z in zones_and["items"]] == ["api.example.com"]
    zones_or = client.get("/api/hosted-zones?f=name:shop&f=name:mycompany&op=or").json()
    assert zones_or["total"] == 2
    assert client.get("/api/hosted-zones?f=all:storefront").json()["total"] == 1
    assert client.get("/api/hosted-zones?f=name:100%25").json()["total"] == 0  # % is literal, not a wildcard

    zid = client.get("/api/hosted-zones?f=name:example.com&f=description:primary").json()["items"][0]["id"]
    base = f"/api/hosted-zones/{zid}/records"
    assert client.get(f"{base}?f=name:www").json()["total"] == 1
    assert client.get(f"{base}?f=value:mail1").json()["total"] == 1
    assert client.get(f"{base}?f=name:www&f=value:mail1&op=or").json()["total"] == 2
    assert client.get(f"{base}?f=name:www&f=value:mail1").json()["total"] == 0


def test_private_zone_needs_vpc_and_tags_are_validated(client):
    no_vpc = client.post("/api/hosted-zones", json={"name": "priv.test", "type": "private"})
    assert no_vpc.status_code == 400 and no_vpc.json()["error"]["field"] == "vpc_id"
    ok = client.post("/api/hosted-zones", json={
        "name": "priv.test", "type": "private", "vpc_id": "vpc-0a1b2c3d4e5f67890", "vpc_region": "us-east-1",
        "tags": [{"key": "team", "value": "net"}],
    })
    assert ok.status_code == 201 and ok.json()["vpc_id"] == "vpc-0a1b2c3d4e5f67890"
    zid = ok.json()["id"]
    dup = client.put(f"/api/hosted-zones/{zid}/tags", json=[{"key": "a", "value": "1"}, {"key": "a", "value": "2"}])
    assert dup.status_code == 400 and dup.json()["error"]["field"] == "tags"
    reserved = client.put(f"/api/hosted-zones/{zid}/tags", json=[{"key": "aws:x", "value": ""}])
    assert reserved.status_code == 400
    assert client.put(f"/api/hosted-zones/{zid}/tags", json=[{"key": "env", "value": "dev"}]).json() == [{"key": "env", "value": "dev"}]
    assert client.get(f"/api/hosted-zones/{zid}/tags").json() == [{"key": "env", "value": "dev"}]


def test_batch_error_reports_item_index_and_import_rejects_foreign_names(client):
    zid = client.post("/api/hosted-zones", json={"name": "batch.test"}).json()["id"]
    base = f"/api/hosted-zones/{zid}/records"
    r = client.post(base, json=[
        {"name": "a", "type": "A", "values": ["1.1.1.1"]},
        {"name": "b", "type": "A", "values": ["1.1.1.1"]},
        {"name": "c", "type": "A", "values": ["not-an-ip"]},
    ])
    assert r.status_code == 400 and r.json()["error"]["index"] == 2
    out = client.post(f"{base}/import", json={"zone_file": "other.example. 300 IN A 1.2.3.4"})
    assert out.status_code == 400 and "outside the hosted zone" in out.json()["error"]["message"]


def test_errors_share_one_shape(client):
    missing = client.get("/api/nope")
    assert missing.status_code == 404 and missing.json()["error"]["code"] == "NotFound"
    invalid = client.post("/api/hosted-zones", json={"description": "no name"})
    assert invalid.status_code == 422 and invalid.json()["error"]["field"] == "name"
    export = client.get("/api/hosted-zones?f=name:example.com&f=description:primary").json()["items"][0]["id"]
    bind = client.get(f"/api/hosted-zones/{export}/export?format=bind").text
    assert "IN\tMX\t10 mail1.example.com" in bind
