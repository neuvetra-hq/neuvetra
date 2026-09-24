# M76 planning review

Root coordinator, September 16, 2026. Accepted for bounded development implementation; not a method or customer release.

The product brief, accounting contract and CTO contract support the same demonstration: independent stationary equipment discovery, two separately metered admitted gas devices and one fixed fossil No. 2 emergency generator. Root independently inspected the [EPA 2025 factor PDF](https://www.epa.gov/system/files/documents/2025-01/ghg-emission-factors-hub-2025.pdf), Table 1/11, and [stationary guidance](https://www.epa.gov/sites/default/files/2020-12/documents/stationaryemissions.pdf), sections 2–3. The gas and No. 2 factor units agree with the proposed chain. The guide distinguishes measured fuel consumption from purchases and prefers available source-specific heat/carbon information. The generator candidate therefore requires explicit unavailability of that information and carries default-factor uncertainty.

This review selects the default-HHV chain consistently rather than mixing rounded per-gallon factors. It accepts the accounting author's independently derived expectations as test targets, not evidence that application arithmetic works. Native arithmetic, source admission, security, retained reports and recovery remain unrun M76 acceptance gates.

One scope clarification is binding: M76 adds no not-applicable or exclusion disposition, no supported estimate workflow, and no equipment deletion. General accounting discussion of such dispositions does not authorize an implementation shortcut. Unsupported equipment remains a gap. Default heat content is disclosed as a candidate assumption; it does not turn measured fuel input into an hour-based or stock-derived activity estimate.

One generator stream, existing three gas streams, twenty-five declaration rows, all corporate stationary sources and current gas/generator heads form the bounded universe. Covered facilities and entities must be explicit. The reviewed M73 method/renderer and old migrations remain unchanged. New schema19 storage and recovery require separate implementation acceptance.

Root authored the product brief and this selection review; it is not independent review of root's future UI or integration. The accounting specialist has authored no production code and will challenge the integrated implementation. CTO/operator authorship and its independent review are recorded separately. All publication continues on the existing rolling PR, with a working demonstration before the next dependent milestone.
