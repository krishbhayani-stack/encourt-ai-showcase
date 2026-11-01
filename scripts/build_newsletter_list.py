"""Build the weekly-newsletter contact list — opted-in people only.

Usage: python3 scripts/build_newsletter_list.py <playtomic-customers-export.csv> <bsport-members.csv> <out.csv>

Consent sources (any one is enough):
  - Playtomic customers export: commercial_communications == 'accepted' (tri-state; never truthiness)
  - BSport members pull: accept_email == true (not archived)
  - reports/raw/2026-07-10-email-newsletters.csv: website-form / newsletter-signup opt-ins
Removed: anyone 'rejected' on Playtomic (explicit opt-out wins), @encourtpadel.co.uk staff,
malformed emails. Deduped by lowercase email.
"""
import csv, collections, re, sys

PT, BS, OUT = sys.argv[1:4]
NL = 'reports/raw/2026-07-10-email-newsletters.csv'
E = lambda s: (s or '').strip().lower()
valid = lambda e: re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]{2,}$', e)

pt = {E(r['email']): r for r in csv.DictReader(open(PT, encoding='utf-8-sig')) if r['email'].strip()}
bs = {E(r['email']): r for r in csv.DictReader(open(BS, encoding='utf-8-sig')) if r['email'].strip()}
out, drop = {}, collections.Counter()

def add(e, name, phone, src, mem, basis):
    o = out.setdefault(e, dict(name=name.strip(), email=e, phone='', source=[], membership='', consent_basis=[]))
    if src not in o['source']: o['source'].append(src)
    if basis not in o['consent_basis']: o['consent_basis'].append(basis)
    o['name'] = o['name'] or name.strip()
    o['phone'] = o['phone'] or (phone or '').strip()
    o['membership'] = o['membership'] or (mem or '')

for e, r in pt.items():
    if r['commercial_communications'] == 'accepted':
        add(e, r['name'], r['phone_number'], 'playtomic',
            '' if r['category'] in ('', 'undefined') else r['category'], 'Playtomic opt-in')
for e, r in bs.items():
    if r['accept_email'].lower() == 'true' and r['archived'].lower() != 'true':
        add(e, r['name'], r['phone'], 'bsport', '', 'BSport email opt-in')
for r in csv.DictReader(open(NL, encoding='utf-8-sig')):
    for b in r['consent_basis'].split(' + '):
        if 'Playtomic' not in b:
            add(E(r['email']), r['name'], r['phone'],
                'website form' if 'website' in b else 'newsletter signup', r['membership'], b)

for e in list(out):
    p = pt.get(e)
    if p and p['commercial_communications'] == 'rejected': drop['opted out on Playtomic'] += 1
    elif e.endswith('@encourtpadel.co.uk'): drop['staff'] += 1
    elif not valid(e): drop['invalid email'] += 1
    else: continue
    del out[e]

rows = sorted(out.values(), key=lambda r: r['name'].lower())
for r in rows:
    r['source'] = ' + '.join(r['source']); r['consent_basis'] = ' + '.join(r['consent_basis'])
w = csv.DictWriter(open(OUT, 'w', newline=''), fieldnames=['name', 'email', 'phone', 'source', 'membership', 'consent_basis'])
w.writeheader(); w.writerows(rows)

c = collections.Counter(s for r in rows for s in r['source'].split(' + '))
only = collections.Counter(r['source'] for r in rows if ' + ' not in r['source'])
print(f'{len(rows)} contacts | by source {dict(c)} | only-from {dict(only)} | removed {dict(drop)}')
