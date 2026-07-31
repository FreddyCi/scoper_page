# Market Sizing: AI-Assisted RFP/Bid-Response & Proposal Software for Construction Trade Subcontractors

## TL;DR
- The niche is real but modest in absolute dollars: a defensible **bottoms-up TAM of roughly $250M–$600M/year in North America** for a simple, affordable, sub-focused bid-response tool, with a realistic **SAM of ~$150M–$250M** (SMB commercial-bidding trade subs) and a credible **3–5 year SOM of ~$5M–$20M ARR**. The roofing beachhead alone is worth ~$7M–$10M/year.
- **No incumbent occupies the exact wedge you describe.** The AI scope-extraction tools that exist today (Downtobid, Palcode.ai) are built for the *general-contractor* side (creating and sending bid packages), while sub-facing tools (BuildingConnected Bid Board Pro, PlanHub, SmartBid) are bid *boards/lead networks* with little-to-no AI scope-of-work extraction or proposal generation. A sub-side "Scoper + simple response" tool is a genuine gap.
- Third-party market-sizing reports for "construction bid management software" are **unreliable and wildly inconsistent** (from $783M to a clearly erroneous $14.3B for overlapping years); none cleanly isolate the subcontractor-vs-GC split, so a bottoms-up model built on Census firm counts is far more trustworthy than any published top-down figure.

## Key Findings

**1. The addressable universe is large by firm count but fragmented and low-ARPU.** The US has on the order of half a million employer specialty-trade-contractor (NAICS 238) establishments and roughly 1.9M additional nonemployer (owner-operator) firms. But about 90% of trade-contractor firms have fewer than 20 employees, and only a fraction do competitive commercial bidding to GCs (many roofers, painters and flooring firms sell direct to owners/homeowners). The economically addressable set — SMB trade subs that respond to GC bid packages/MSAs — is on the order of **200,000–290,000 US firms**, plus roughly 15% more in Canada.

**2. Roofing specifically is a small, extremely fragmented beachhead.** U.S. Census Bureau Statistics of U.S. Businesses 2022 for NAICS 238160 (released April 10, 2025) reports **24,044 employer roofing firms operating 24,532 establishments, employing 204,998 paid workers and paying $13.3 billion in annual payroll**, with total industry receipts of $68.8 billion. Per the same SUSB 2022 data, **65.4% of roofing firms had fewer than 5 employees and 90.8% had fewer than 20 employees**. Commercial/institutional roofers who bid GC packages (vs. homeowner storm-chasers) are perhaps a quarter to a third of the total — roughly 6,000–8,500 firms.

**3. Willingness-to-pay is low and the market is anchored toward "free-to-sub."** On the sub side, BuildingConnected's Bid Board Pro and SmartBid give subs free or near-free access (GCs pay); paid sub tools like PlanHub ($1,199–$3,299/yr by radius) and ConstructionBids.ai ($2,940–$5,940/yr) exist but see resistance. A simple, affordable tool realistically prices at ~$50–$150/user/month ($600–$1,800/yr), so a blended ARPU near ~$1,000/yr is a reasonable planning assumption.

**4. Published market-sizing reports conflict badly and should not be trusted at face value.** Estimates for "construction bid management software" range from $783M (2023) to roughly $1.0–1.5B (2024–25) to a clear outlier of $14.3B (2024). None cleanly break out subcontractor vs. GC spend.

**5. Demand/pain is real and well-documented.** Subs win only a minority of bids, chase too many low-probability ITBs, and drown in irrelevant invites and dense documents; small subs explicitly complain that GC-oriented tools are too complex and expensive.

**6. Competitive gap confirmed.** AI scope extraction today is GC-side; sub-side proposal/response generation with AI scoping is unserved.

## Details

### Vendor landscape, economics, and pricing

**BuildingConnected (Autodesk).** Per Autodesk's January 23, 2019 press release, the acquisition closed "for $275 million net of cash acquired... funded... using cash on hand," and at that time "BuildingConnected is the largest and most active digital network in the construction industry with 700,000 construction professionals using the platform" (now marketed as 1M+). Autodesk guided only an "immaterial revenue and Annualized Recurring Revenue (ARR) benefit" for FY2020, so the frequently-cited ~$50M ARR figure is founder/press-anecdote, not a company-verified number. Its sub-facing product, **Bid Board Pro**, is a bid board, not an AI scope tool. Pricing is opaque and sales-quoted; third-party estimates put GC pricing at roughly $3,600–$5,000/yr on the low end, with larger buyers reporting ~$22,000/yr bundles and some "six figures." Users report the platform has stagnated post-acquisition and that GCs are hunting for cheaper alternatives. The founder has cited a ~93% cohort retention rate historically. This validates strong retention economics for a network product but also confirms an opening below its price point.

**ConstructConnect (Roper Technologies).** Acquired by Roper in 2016. Revenue estimates diverge sharply across data vendors — roughly $120M (Getlatka, "ARR") to $172M (Zippia) to ~$290M (ZoomInfo/Datanyze) — with ~1,100 employees. It owns **SmartBid**, a GC-focused bid management tool (subs invited free; GC pricing ~$250–$1,500/mo, ~$5,000/yr minimum reported). The revenue-estimate spread itself illustrates how unreliable third-party vendor data is in this segment.

**PlanHub.** Founded 2008, West Palm Beach; ~$28M estimated annual revenue, 101–200 employees, ~$41M funding, ~40,000 users. Subcontractor "Premier" plans run **$1,199–$3,299/yr** scaled by coverage radius (25–200 miles). Serves GCs, subs and suppliers; a lead/plan-room network, not an AI scope extractor.

**SmartBid.** GC-focused; subs free. ~$250–$1,500/mo. No meaningful AI scope extraction.

**Downtobid (Y Combinator).** Founded 2019 (Andy Lee, Kevin Wu). The closest analog to your "Scoper": its AI reads plan sets, identifies trade scopes, drafts scope notes, and generates ITBs — but it is built primarily for the **GC/estimator side** (creating bid packages to send *out*). Transparent pricing: $149/mo for organizations; sub-side "leads" bid board from $119/mo and full bid management from $299/mo. Claims a 57,000-verified-subcontractor network and ~30% higher response rates.

**Palcode.ai.** GC-side "AI Workers" (SolicitationPal, BidPackagePal, BidLevelingPal, VendorOnboardingPal). BidPackagePal reads drawings/specs and generates trade-specific scope sheets by CSI division; BidLevelingPal compares incoming sub bids against scope. Again, GC-oriented — it helps GCs process subs, not subs respond to GCs.

**ConstructionBids.ai.** Sub-facing but focused on *public-bid discovery* (aggregating government solicitations), not AI scope extraction or proposal generation for GC packages. ~$2,940–$5,940/yr.

**Tenderfield.** Australian construction/tender collaboration tool, mid-tier GCs/developers, ~AU$24–30/user/month. Not a US sub-focused AI tool.

**Enterprise RFP tools (Loopio, Responsive/RFPIO).** Horizontal RFP-response software for corporate proposal teams. Loopio: 1,500+ organizations, estimated $54K–$142K/yr. Responsive: ~2,000 customers, $600B+ in opportunities managed. Both are far too expensive and generic for a blue-collar roofing sub — confirming the "too complex/too expensive" complaint.

### Bottoms-up TAM/SAM/SOM model

**Universe (US employer specialty-trade contractors, NAICS 238):** ~500,000 employer establishments (2020 County Business Patterns baseline of ~498K, higher in 2022); ~1.9M additional nonemployer firms (derived from Census 2022 Nonemployer Statistics, where the whole construction sector had 2,875,590 nonemployers and NAICS 238 was ~67% of construction nonemployers in 2021). Roughly 90% of employer firms have <20 employees.

**TAM (North America).** Take all NA employer trade-sub establishments that could plausibly use a bid-response tool. Even generously assuming ~500K US + ~15% Canada ≈ 575K firms at ~$1,000/yr blended ARPU yields a theoretical **ceiling near $575M–$600M**. This is the outer bound assuming near-universal adoption, which is unrealistic. A more disciplined TAM that already screens out consumer-facing trades lands closer to **$250M–$450M**.

**SAM (serviceable).** Restrict to SMB trade subs that (a) do competitive commercial/public bidding to GCs, (b) are the size that finds Procore/RFPIO/Loopio too complex/expensive, and (c) operate in English-speaking North America. Estimating ~40–50% of employer trade subs bid competitively to GCs → ~200,000–250,000 US firms, plus Canada ≈ 230,000–290,000 firms. At ARPU ~$600–$1,000/yr, **SAM ≈ $150M–$250M/year**.

**SOM (obtainable, 3–5 years).** Sub-focused SaaS in a fragmented, low-tech-adoption trade realistically penetrates low single digits of SAM within 3–5 years. At ~2–8% of SAM, **SOM ≈ $5M–$20M ARR**.

**Roofing beachhead.** ~6,000–8,500 US commercial-bidding roofing firms × ~$1,000–$1,200 ARPU ≈ **$7M–$10M** serviceable revenue in roofing alone — a credible wedge before expanding to adjacent trades (siding, waterproofing, glazing, drywall, flooring, concrete).

### Bid volume, win rates, and ARPU signals
Industry sources converge on subcontractor win rates in the 20–30% range: per K-38 Consulting, "most contractors win only 20-30% of submitted bids," and per Bidi Contracting (2026), "the commercial construction industry average is approximately 25% — one win for every four bids submitted... For hard competitive public bids, a 10-20% win rate is typical." Bid-hit ratios reflect this: ConstructConnect cites roughly 4:1 to 7:1 on competitive private work and 2:1 to 3:1 on negotiated/repeat work, while public work "should not exceed 10 or 11 to 1" (Sunflower Bank/George Hedley). A client responding to "hundreds of RFPs/year" is at the high-activity end; a typical active commercial sub responds to perhaps dozens to low-hundreds of bid packages annually. High bid volume is precisely where a scope-extraction/response tool creates the most time savings — the ROI story is strongest for the busiest subs, who are also the best-fit early customers.

### Where the market-sizing reports disagree
"Construction bid management software" estimates conflict severely:
- **Verified Market Research (Report ID 384443, Feb 2025):** "Construction Bid Management Software Market size was valued at USD 783 Million in 2023 and is projected to reach USD 2020 Million by 2030, growing at a CAGR of 16.17% during the forecast period 2024-2030."
- **The Business Research Company:** ~$1.16B (2025), → $2.12B by 2029.
- **Global Growth Insights (Report 104136):** the market "was valued at USD 964.64 million in 2025 and is expected to reach USD 1,080.1 million in 2026... reach nearly USD 2,985.4 million by 2035, representing... a CAGR of 11.96%."
- **Dataintelo / Verified Market Reports:** ~$1.5B (2023/2025).
- **Future Market Report:** an implausible **$14,300.5M (2024)** — an obvious outlier that appears to be an error or a far broader category definition.

"RFP software" is separately estimated at ~$1.6B (2026). These reports are syndicated, methodologically opaque, and do not isolate the subcontractor segment; treat them as directional at best.

## Recommendations

**Stage 1 (now – 6 months): Win the roofing beachhead and prove the Scoper's ROI.** Target the ~6,000–8,500 US commercial-bidding roofing subs. Price simply and transparently at ~$50–$150/user/month to undercut PlanHub/ConstructionBids.ai and exploit BuildingConnected "sticker shock." Instrument time-saved-per-bid and win-rate lift as your core proof metrics. *Threshold to proceed:* reach ~200–400 paying roofing seats and demonstrate measurable time savings (target 50%+ reduction in scope-review time).

**Stage 2 (6–18 months): Expand to adjacent trades that bid the same GC packages** — waterproofing, glazing, drywall/insulation, flooring, concrete, masonry. These share document formats and MSA structures, so the Scoper generalizes cheaply. *Threshold:* >90% scope-extraction accuracy on standard digital plan sets before cross-trade marketing.

**Stage 3 (18–36 months): Layer proposal-generation and MSA/compliance-response automation** (bonding thresholds, insurance certs, participation goals, exclusions/qualifications). This is where you differentiate durably from GC-side tools and can lift ARPU. *Threshold:* net revenue retention >100% and CAC payback <12 months before raising to scale.

**What would change the plan:** If ARPU proves capped near free (because GCs keep paying and subs won't), pivot to a GC-paid or GC-sponsored distribution model (subs get it free, GCs pay for coverage/quality) — the same wedge BuildingConnected and PlanHub use. If a well-funded incumbent (Autodesk, Procore, ConstructConnect, or Downtobid/Palcode) ships true sub-side AI scoping, compete on price, simplicity, and trade-specific templates rather than breadth.

## Caveats
- **Every dollar figure is a modeled estimate, not a measured market.** The TAM/SAM/SOM rests on Census firm counts (reliable) multiplied by assumed adoption and ARPU (uncertain). The ARPU assumption is the single biggest swing factor.
- **The "commercial-bidding subset" percentage is an assumption.** No public dataset cleanly separates trade subs that bid GC packages from those selling direct to owners; the 40–50% figure is a judgment call and could be materially lower for consumer-facing trades like roofing.
- **Third-party vendor revenue and market-size figures conflict and are frequently AI-generated or scraped.** ConstructConnect revenue estimates alone span $120M–$290M. The $14.3B bid-management figure is almost certainly erroneous. These are flagged, not relied upon.
- **Census subsector totals for 2022 (all of NAICS 238) could not be pulled from primary files during research**; the ~500K employer-establishment figure is anchored to the 2020 County Business Patterns baseline (~498K) plus known growth, not a verified 2022 total. The roofing (238160) figures, by contrast, are verified against Census SUSB 2022.
- **Low tech adoption in blue-collar trades cuts both ways:** it means a large greenfield, but also slow sales cycles and skepticism, which is why the SOM is conservative.