#!/usr/bin/env python3
"""Deterministic pure-P2P exclusion filter + ranking.

Spec: brain/specs/purep2p-filter-script.md (read it first — it is the ground truth).
No network, no judgment: bookings JSON + buyer-id list in, ranked survivors CSV out.
The purep2p-desk-sheet skill owns the live pulls, top-7 cut, households, PDF, caveats.
"""

import argparse
import csv
import json
import sys
from datetime import datetime, timedelta
from pathlib import Path

STAFF_NAMES = {"<head coach full name>", "the club", "<founder full name>"}  # redacted for the public copy

GAME_SKUS = {
    "open match registration",
    "user booking registration",
    "public class registration",
    "tournament registration",
    "academy class registration",
    "user recurring booking registration",
}

CUSTOMER_FILES = [
    "data/playtomic/2026-07-09-customers.csv",
    "data/playtomic/customers_2242.csv",
]
SUBRUN_FILE = "reports/raw/2026-07-12-subscription-status-run.csv"
INTRO_FILE = "reports/raw/2026-07-15-intro-offpeak-full-history.csv"
CONV_FILE = "reports/raw/2026-07-14-nonmember-conversion-list-15-19jul.csv"
PAYMENTS_FILE = "data/playtomic/payments_24may-22aug.csv"


def norm_name(s):
    return " ".join((s or "").strip().lower().split())


def norm_email(s):
    return (s or "").strip().lower() or None


def pick(d, *keys):
    """Tolerant key lookup: first non-empty value among candidate keys."""
    for k in keys:
        v = d.get(k)
        if v not in (None, "", "-"):
            return v
    return None


def load_csv(path):
    with open(path, newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def load_exclusions(root):
    """Returns (ids, emails, full_names) to exclude, plus per-source counts."""
    ids, emails, names, counts = set(), set(), set(), {}

    n = 0
    for rel in CUSTOMER_FILES:
        p = root / rel
        if not p.exists():
            continue
        for row in load_csv(p):
            if (row.get("category_name") or "").strip():
                ids.add(str(row["id"]).strip())
                if norm_email(row.get("email")):
                    emails.add(norm_email(row["email"]))
                n += 1
    counts["customers-with-category"] = n

    rows = load_csv(root / SUBRUN_FILE)
    for row in rows:
        ids.add(str(row["user_id"]).strip())
        if norm_email(row.get("email")):
            emails.add(norm_email(row["email"]))
    counts["subscription-run"] = len(rows)

    rows = load_csv(root / INTRO_FILE)
    for row in rows:
        nm = norm_name(row.get("name"))
        if len(nm.split()) >= 2:
            names.add(nm)
        if norm_email(row.get("email")):
            emails.add(norm_email(row["email"]))
    counts["intro-history"] = len(rows)

    n = 0
    for row in load_csv(root / CONV_FILE):
        if "intro" in (row.get("segment") or "").lower():
            nm = norm_name(row.get("name"))
            if len(nm.split()) >= 2:
                names.add(nm)
            if norm_email(row.get("email")):
                emails.add(norm_email(row["email"]))
            n += 1
    counts["conversion-intro-segment"] = n

    return ids, emails, names, counts


def load_payments(root):
    """Spend + games per User id from the ;-separated export (header after summary lines)."""
    spend, games = {}, {}
    path = root / PAYMENTS_FILE
    with open(path, newline="", encoding="utf-8-sig") as f:
        header = None
        for raw in csv.reader(f, delimiter=";"):
            if header is None:
                if "User id" in raw:
                    header = raw
                continue
            row = dict(zip(header, raw))
            uid = (row.get("User id") or "").strip()
            sku = (row.get("Product SKU") or "").strip().lower()
            status = (row.get("Payment status") or "").strip().lower()
            if not uid or sku not in GAME_SKUS or status != "paid":
                continue
            try:
                total = float((row.get("Total") or "0").replace(",", ""))
            except ValueError:
                continue
            spend[uid] = spend.get(uid, 0.0) + total
            if total > 0:
                games[uid] = games.get(uid, 0) + 1
    return spend, games


def load_conv_spend_by_email(root):
    out = {}
    for row in load_csv(root / CONV_FILE):
        em = norm_email(row.get("email"))
        if not em:
            continue
        try:
            out[em] = float((row.get("paid_gbp_to_4jul") or "0").replace(",", ""))
        except ValueError:
            pass
    return out


def bst(utc_str):
    """'2026-07-30T19:00:00' UTC -> '20:00' BST."""
    s = utc_str.replace("Z", "").split(".")[0]
    return (datetime.fromisoformat(s) + timedelta(hours=1)).strftime("%H:%M")


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--bookings", required=True, help="JSON array of /api/v1/bookings objects")
    ap.add_argument("--buyers", required=True, help="text file: one live benefit-buyer user-id per line")
    ap.add_argument("--repo-root", default=str(Path(__file__).resolve().parent.parent))
    ap.add_argument("--out", required=True, help="output CSV path")
    args = ap.parse_args()

    root = Path(args.repo_root)
    bookings = json.loads(Path(args.bookings).read_text())
    if isinstance(bookings, dict):  # tolerate a wrapped response
        bookings = pick(bookings, "bookings", "content", "data") or []
    buyer_ids = {ln.strip() for ln in Path(args.buyers).read_text().splitlines() if ln.strip()}

    excl_ids, excl_emails, excl_names, counts = load_exclusions(root)
    spend_by_id, games_by_id = load_payments(root)
    conv_by_email = load_conv_spend_by_email(root)

    # Collect participants across non-cancelled bookings, merging repeat slots per person.
    people = {}  # key -> dict
    n_participants = 0
    n_guests = 0
    dropped = {"buyer-sweep": 0, "reference-csvs": 0, "staff": 0}
    for b in bookings:
        status = str(pick(b, "status") or "").upper()
        if "CANCEL" in status:
            continue
        start = pick(b, "booking_start_date", "start_date", "start", "startDate")
        court = pick(b, "resource_name", "court", "resource") or "?"
        if isinstance(court, dict):
            court = pick(court, "name") or "?"
        pinfo = b.get("participant_info") or {}
        for p in pinfo.get("participants") or []:
            pid = pick(p, "participant_id", "user_id", "userId", "id")
            # GUEST placeholders ("Player 2/3/4", ids guest:<ts>:<hash>) are not people.
            ptype = str(pick(p, "participant_type", "type") or "").upper()
            if (ptype and ptype != "CUSTOMER") or str(pid or "").startswith("guest:"):
                n_guests += 1
                continue
            n_participants += 1
            pid = str(pid).strip() if pid is not None else None
            name = pick(p, "name", "full_name", "fullName") or ""
            email = norm_email(pick(p, "email"))
            key = pid or email or norm_name(name)
            slot = f"{bst(start)} {court}" if start else str(court)
            if key in people:
                if slot not in people[key]["slots"]:
                    people[key]["slots"].append(slot)
                continue
            # Exclusion checks (id -> email -> full name), staff last so counts read clean.
            if pid and pid in buyer_ids:
                dropped["buyer-sweep"] += 1
                people[key] = {"excluded": True, "slots": []}
                continue
            if (pid and pid in excl_ids) or (email and email in excl_emails) or (
                len(norm_name(name).split()) >= 2 and norm_name(name) in excl_names
            ):
                dropped["reference-csvs"] += 1
                people[key] = {"excluded": True, "slots": []}
                continue
            if norm_name(name) in STAFF_NAMES:
                dropped["staff"] += 1
                people[key] = {"excluded": True, "slots": []}
                continue
            people[key] = {
                "excluded": False,
                "name": name,
                "participant_id": pid or "",
                "email": email or "",
                "phone": pick(p, "phone", "phone_number", "phoneNumber") or "",
                "optin": pick(p, "accepts_commercial_communications") ,
                "slots": [slot],
            }

    survivors = []
    for v in people.values():
        if v.get("excluded"):
            continue
        uid, em = v["participant_id"], v["email"]
        spend = max(spend_by_id.get(uid, 0.0), conv_by_email.get(em, 0.0))
        survivors.append({
            "name": v["name"],
            "participant_id": uid,
            "spend_gbp_floor": round(spend, 2),
            "games_paid": games_by_id.get(uid, 0),
            "slots_bst": "; ".join(v["slots"]),
            "phone": v["phone"],
            "optin": {True: "Yes", False: "No"}.get(v["optin"], ""),
            "email": em,
        })
    survivors.sort(key=lambda r: (-r["spend_gbp_floor"], -r["games_paid"], r["name"].lower()))

    with open(args.out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(survivors[0].keys()) if survivors else
                           ["name", "participant_id", "spend_gbp_floor", "games_paid",
                            "slots_bst", "phone", "optin", "email"])
        w.writeheader()
        w.writerows(survivors)

    uniq = len(people)
    print(f"participants: {n_participants} slots, {uniq} unique people "
          f"(+{n_guests} GUEST placeholder slots skipped)")
    print(f"dropped: buyer-sweep {dropped['buyer-sweep']} · reference-csvs "
          f"{dropped['reference-csvs']} · staff {dropped['staff']}")
    print(f"reference-set sizes: {counts}")
    print(f"pure P2P survivors: {len(survivors)} -> {args.out}")


if __name__ == "__main__":
    sys.exit(main())
