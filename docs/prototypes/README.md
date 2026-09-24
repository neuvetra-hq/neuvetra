# Corporate coverage planning demonstration

M70 is a fictional, nonproduction planning example. It has no server persistence, customer-data intake, emissions calculation, regulatory decision or assurance result.

Build the inline fragment from the scenario and template:

```powershell
python tools/build_m70_demo.py
```

Build a normal standalone page for local demonstration and JSON downloads:

```powershell
python tools/build_m70_demo.py --standalone --output .superpowers/m70-preview/standalone.html
python -m http.server 55770 --bind 127.0.0.1 --directory .superpowers/m70-preview
```

Open `http://127.0.0.1:55770/standalone.html`. The inline conversation view exposes a copyable JSON snapshot because its sandbox blocks downloads; the standalone version also downloads the snapshot. Neither action saves a company inventory. Reload/reset restores fictional initial state.

Read [product acceptance criteria](../research/m70-product-brief.md), [architecture](../research/m70-architecture.md) and [browser verification](../../evaluations/research-qa/m70-browser-verification.md). Current primary-source planning lives in [the requirements matrix](../research/m70-requirements-matrix.json); its dated facts and outstanding gates are not production legal rules.
