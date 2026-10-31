#!/usr/bin/env python3
"""Labelled spend-ledger fixtures for the NAICS suggestion accuracy test (round 3 lane C, owner decision 8; Claude,
31 October 2026).

Writes two CSV files under apps/site-web/src/lib/testdata/:

1. spend-ledger-labelled-200.csv: a realistic 200-line US accounts-payable export of a mid-size light manufacturer
   (ERP-style header, US dates MM/DD/YYYY, vendors, GL accounts and names, memos, some blank memos), every line labelled.
2. spend-ledger-reviewer-r2-labelled.csv: the round-2 product reviewer's independent 200-line ledger
   (reviews/tmp-ux2/imp/acme-ap-2025.csv, written by the reviewer, not by this lane), byte-for-byte cells, with the same
   label columns added by the rules in REVIEWER_LABELS below.

Label columns: "Label NAICS 2017" is a six-digit 2017 NAICS code that the EPA Supply Chain GHG Emission Factors v1.3
lists, or `not_a_purchase` (owner decision 8: payroll, wages, taxes, depreciation, amortisation, interest, intercompany,
bank fees, and employer retirement contributions, which are compensation), or `energy_scope_1_2` (a fuel or energy bill:
its emissions are counted in Scope 1 or 2 and category 3 from the bill, so the spend line is withdrawn rather than
mapped). "Label category" is the Scope 3 category the purchase belongs in (blank for the two withdraw labels).
"Justification" says why, in one line. Labels follow the NAICS 2017 definitions: goods are mapped to the sector that
makes them (not the distributor's wholesale code, which the EEIO data treats as the trade margin only), services to the
sector that provides them.

Run: python3 tools/scope3/make_labelled_spend_ledgers.py <reviewer acme-ap-2025.csv>
"""
import csv
import io
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "apps/site-web/src/lib/testdata"
HEADER = ["Document Number", "Posting Date", "Vendor Name", "Account", "Account Name", "Memo", "Amount", "Currency"]
LABELS = ["Label NAICS 2017", "Label category", "Justification"]
NP, EN = "not_a_purchase", "energy_scope_1_2"

# (vendor, account, account name, memo, label, category, justification, lines, (low, high) USD)
ITEMS = [
    # Raw materials
    ("Pacific Steel Supply", "5010", "Raw materials - metals", "Hot rolled steel coil", "331110", 1, "Hot-rolled coil is made at steel mills: 331110 Iron and Steel Mills.", 5, (9000, 42000)),
    ("Pacific Steel Supply", "5010", "Raw materials - metals", "Cold rolled steel sheet", "331221", 1, "Cold-rolling purchased steel into sheet is 331221 Rolled Steel Shape Manufacturing.", 3, (6000, 30000)),
    ("Pacific Steel Supply", "5010", "Raw materials - metals", "Steel tube 2in sch 40", "331210", 1, "Tube made from purchased steel: 331210 Iron and Steel Pipe and Tube Manufacturing from Purchased Steel.", 2, (3000, 12000)),
    ("Northwest Aluminum", "5010", "Raw materials - metals", "Aluminum extrusions 6061", "331318", 1, "Extruded aluminum shapes: 331318 Other Aluminum Rolling, Drawing, and Extruding.", 3, (6000, 26000)),
    ("Northwest Aluminum", "5010", "Raw materials - metals", "Aluminum ingot A356", "331313", 1, "Primary aluminum ingot: 331313 Alumina Refining and Primary Aluminum Production.", 1, (8000, 24000)),
    ("Northwest Aluminum", "5010", "Raw materials - metals", "Aluminum sheet 5052", "331315", 1, "Aluminum sheet and plate: 331315 Aluminum Sheet, Plate, and Foil Manufacturing.", 1, (4000, 15000)),
    ("Copperline Wire & Cable", "5040", "Components", "Bare copper wire", "331420", 1, "Drawing copper wire: 331420 Copper Rolling, Drawing, Extruding, and Alloying.", 1, (2000, 9000)),
    ("Copperline Wire & Cable", "5040", "Components", "Insulated power cable", "335929", 1, "Insulated energy cable: 335929 Other Communication and Energy Wire Manufacturing.", 1, (2000, 9000)),
    ("ResinTech Polymers", "5020", "Raw materials - plastics", "ABS resin pellets", "325211", 1, "Plastics resin: 325211 Plastics Material and Resin Manufacturing.", 3, (3000, 18000)),
    ("ResinTech Polymers", "5020", "Raw materials - plastics", "Polypropylene resin", "325211", 1, "Plastics resin: 325211 Plastics Material and Resin Manufacturing.", 2, (3000, 18000)),
    ("ResinTech Polymers", "5020", "Raw materials - plastics", "", "325211", 1, "Blank memo; the account is plastics raw material from a resin supplier: 325211.", 2, (3000, 18000)),
    # Components
    ("Bosch Rexroth Corp", "5040", "Components", "Hydraulic valves", "332912", 1, "Hydraulic (fluid power) valves: 332912 Fluid Power Valve and Hose Fitting Manufacturing.", 2, (4000, 12000)),
    ("Bosch Rexroth Corp", "5040", "Components", "Hydraulic cylinders", "333995", 1, "Hydraulic cylinders: 333995 Fluid Power Cylinder and Actuator Manufacturing.", 1, (3000, 10000)),
    ("Allied Electronics", "5040", "Components", "Bare printed circuit boards", "334412", 1, "Bare boards: 334412 Bare Printed Circuit Board Manufacturing.", 1, (1500, 8000)),
    ("Allied Electronics", "5040", "Components", "Relays and contactors", "335314", 1, "Relays and contactors: 335314 Relay and Industrial Control Manufacturing.", 1, (800, 4000)),
    ("Allied Electronics", "5040", "Components", "Electrical connectors", "334417", 1, "Connectors: 334417 Electronic Connector Manufacturing.", 1, (600, 3000)),
    ("Midwest Fasteners", "5040", "Components", "Hex bolts and nuts", "332722", 1, "Bolts and nuts: 332722 Bolt, Nut, Screw, Rivet, and Washer Manufacturing.", 2, (400, 3500)),
    ("Gates Industrial", "5040", "Components", "Rubber V-belts", "326220", 1, "V-belts: 326220 Rubber and Plastics Hoses and Belting Manufacturing.", 1, (500, 2500)),
    # Packaging, coatings, gases
    ("Uline", "5030", "Packaging", "Corrugated boxes", "322211", 1, "Corrugated boxes: 322211 Corrugated and Solid Fiber Box Manufacturing.", 5, (400, 4200)),
    ("Uline", "5030", "Packaging", "Stretch wrap", "326112", 1, "Stretch film: 326112 Plastics Packaging Film and Sheet Manufacturing.", 2, (300, 2200)),
    ("Uline", "5030", "Packaging", "Packing tape", "322220", 1, "Pressure-sensitive packing tape from purchased materials is in 322220 Paper Bag and Coated and Treated Paper Manufacturing.", 1, (150, 900)),
    ("Pallet Pros", "5030", "Packaging", "Wooden pallets", "321920", 1, "Pallets: 321920 Wood Container and Pallet Manufacturing.", 2, (600, 3200)),
    ("Sherwin-Williams", "5050", "Paint and coatings", "Industrial powder coating", "325510", 1, "Coatings: 325510 Paint and Coating Manufacturing.", 1, (1200, 6000)),
    ("Airgas", "5060", "Shop gases and welding", "Argon cylinders", "325120", 1, "Argon: 325120 Industrial Gas Manufacturing.", 2, (300, 1800)),
    ("Airgas", "5060", "Shop gases and welding", "MIG welder", "333992", 1, "A welder: 333992 Welding and Soldering Equipment Manufacturing.", 1, (1800, 2400)),
    # MRO
    ("Grainger", "6110", "MRO supplies", "Safety gloves", "339113", 1, "Personal safety equipment and protective gloves are in 339113 Surgical Appliance and Supplies Manufacturing.", 2, (120, 1400)),
    ("Grainger", "6110", "MRO supplies", "Fasteners", "332722", 1, "Fasteners: 332722 Bolt, Nut, Screw, Rivet, and Washer Manufacturing (the goods, not Grainger's wholesale code).", 2, (120, 1600)),
    ("Grainger", "6110", "MRO supplies", "Lubricants", "324191", 1, "Lubricants: 324191 Petroleum Lubricating Oil and Grease Manufacturing.", 2, (150, 1500)),
    ("Grainger", "6110", "MRO supplies", "Shop supplies", "332999", 1, "Unspecified MRO consumables: the goods sector, not the distributor's margin-only code 423840; 332999 All Other Miscellaneous Fabricated Metal Product Manufacturing as the proxy.", 2, (120, 1800)),
    ("Fastenal", "6110", "MRO supplies", "Cutting tools", "333515", 1, "Cutting tools: 333515 Cutting Tool and Machine Tool Accessory Manufacturing.", 2, (200, 3100)),
    ("Fastenal", "6110", "MRO supplies", "Grinding wheels", "327910", 1, "Grinding wheels: 327910 Abrasive Product Manufacturing.", 1, (150, 1200)),
    ("McMaster-Carr", "6110", "MRO supplies", "Ball bearings", "332991", 1, "Bearings: 332991 Ball and Roller Bearing Manufacturing.", 1, (150, 1400)),
    # Office
    ("Staples Business Advantage", "6100", "Office supplies", "Toner cartridges", "339940", 1, "Toner cartridges are office supplies (except paper): 339940.", 2, (90, 900)),
    ("Staples Business Advantage", "6100", "Office supplies", "Copy paper", "322121", 1, "Copy paper is made at paper mills: 322121 Paper (except Newsprint) Mills.", 2, (90, 700)),
    ("Staples Business Advantage", "6100", "Office supplies", "Office supplies", "339940", 1, "General office supplies: 339940 Office Supplies (except Paper) Manufacturing.", 2, (60, 500)),
    ("Amazon Business", "6100", "Office supplies", "Office chairs", "337214", 1, "Non-wood office chairs: 337214 Office Furniture (except Wood) Manufacturing.", 1, (600, 1800)),
    ("Amazon Business", "6100", "Office supplies", "Break room coffee", "311920", 1, "Coffee: 311920 Coffee and Tea Manufacturing.", 1, (80, 400)),
    # IT and telecom
    ("Amazon Web Services", "6400", "Software and cloud", "AWS cloud hosting", "518210", 1, "Cloud hosting: 518210 Data Processing, Hosting, and Related Services.", 8, (2100, 3400)),
    ("Microsoft", "6400", "Software and cloud", "Microsoft 365 licenses", "511210", 1, "Software licences: 511210 Software Publishers.", 2, (1800, 1800)),
    ("Salesforce", "6400", "Software and cloud", "CRM subscription", "511210", 1, "A software subscription (SaaS) from its publisher: 511210 Software Publishers.", 2, (5200, 5200)),
    ("Adobe", "6400", "Software and cloud", "Creative Cloud subscription", "511210", 1, "A software subscription from its publisher: 511210 Software Publishers.", 1, (650, 650)),
    ("Zoom Video Communications", "6400", "Software and cloud", "Video conferencing subscription", "511210", 1, "A software subscription from its publisher: 511210 Software Publishers.", 1, (450, 450)),
    ("CDW", "6410", "Computer hardware - expensed", "Monitors", "334118", 1, "Monitors: 334118 Computer Terminal and Other Computer Peripheral Equipment Manufacturing.", 1, (400, 2200)),
    ("CDW", "6410", "Computer hardware - expensed", "Docking stations", "334118", 1, "Docking stations are computer peripherals: 334118.", 1, (300, 1500)),
    ("Accenture", "6620", "Consulting", "ERP implementation consulting", "541512", 1, "Implementing an ERP system: 541512 Computer Systems Design Services.", 1, (18000, 45000)),
    ("Verizon Wireless", "6420", "Telephone and internet", "Mobile phone service", "517312", 1, "Mobile service: 517312 Wireless Telecommunications Carriers (except Satellite).", 5, (900, 1400)),
    ("Comcast Business", "6420", "Telephone and internet", "Internet service", "517311", 1, "Business internet over cable: 517311 Wired Telecommunications Carriers.", 5, (400, 650)),
    # Professional services and insurance
    ("ADP", "6500", "Payroll services", "Payroll processing fee", "541214", 1, "A fee for processing payroll is a purchased service: 541214 Payroll Services.", 6, (1400, 1700)),
    ("Baker Lyman LLP", "6600", "Legal fees", "Contract review", "541110", 1, "Legal work by a law firm: 541110 Offices of Lawyers.", 2, (2500, 16000)),
    ("Baker Lyman LLP", "6600", "Legal fees", "Patent filing", "541110", 1, "Patent work by a law firm: 541110 Offices of Lawyers.", 2, (2500, 16000)),
    ("Deloitte", "6610", "Audit and accounting", "Annual audit fee", "541211", 1, "The financial audit: 541211 Offices of Certified Public Accountants.", 1, (48000, 48000)),
    ("Deloitte", "6610", "Audit and accounting", "Tax return preparation", "541213", 1, "Preparing tax returns is a purchased service: 541213 Tax Preparation Services.", 1, (9000, 9000)),
    ("Robert Half", "6520", "Temporary staffing", "Temp accounting staff", "561320", 1, "Temporary staff: 561320 Temporary Help Services.", 2, (3000, 7000)),
    ("Korn Ferry", "6530", "Recruiting", "Executive search fee", "561312", 1, "Executive search: 561312 Executive Search Services.", 1, (35000, 35000)),
    ("Bright Orbit Marketing", "6630", "Marketing", "Ad campaign management", "541810", 1, "Campaign management by an agency: 541810 Advertising Agencies.", 1, (4000, 12000)),
    ("Vistaprint", "6630", "Marketing", "Printed brochures", "323111", 1, "Brochure printing: 323111 Commercial Printing (except Screen and Books).", 1, (300, 1800)),
    ("Freeman", "6630", "Marketing", "Trade show registration", "561920", 1, "Paying a trade show: 561920 Convention and Trade Show Organizers.", 1, (6000, 6000)),
    ("McKinsey & Company", "6620", "Consulting", "Operations strategy consulting", "541611", 1, "Management consulting: 541611 Administrative Management and General Management Consulting Services.", 1, (60000, 60000)),
    ("ERM", "6620", "Consulting", "Environmental compliance consulting", "541620", 1, "Environmental consulting: 541620 Environmental Consulting Services.", 1, (12000, 12000)),
    ("SGS North America", "6640", "Testing and certification", "Product safety testing", "541380", 1, "Product testing by a lab: 541380 Testing Laboratories.", 1, (2500, 7000)),
    ("Travelers", "6250", "Insurance", "General liability insurance premium", "524126", 1, "Liability cover: 524126 Direct Property and Casualty Insurance Carriers.", 1, (24000, 24000)),
    ("Blue Shield of California", "6260", "Employee health insurance", "Group health premium", "524114", 1, "Employee health cover bought from a carrier: 524114 Direct Health and Medical Insurance Carriers.", 2, (18000, 21000)),
    ("Marsh", "6250", "Insurance", "Insurance brokerage fee", "524210", 1, "A broker's fee: 524210 Insurance Agencies and Brokerages.", 1, (3500, 3500)),
    # Facilities
    ("Cintas", "6120", "Uniforms and facility services", "Uniform rental", "812332", 1, "Uniform rental and laundering: 812332 Industrial Launderers.", 4, (700, 900)),
    ("ABM Industries", "6130", "Janitorial", "Office cleaning", "561720", 1, "Cleaning: 561720 Janitorial Services.", 2, (2200, 3100)),
    ("Allied Universal", "6140", "Security", "Security guard services", "561612", 1, "Guards: 561612 Security Guards and Patrol Services.", 2, (4100, 5200)),
    ("BrightView", "6150", "Landscaping", "Grounds maintenance", "561730", 1, "Grounds care: 561730 Landscaping Services.", 1, (900, 1400)),
    ("Comfort Systems USA", "6160", "Repairs and maintenance", "HVAC maintenance contract", "238220", 1, "HVAC service by a mechanical contractor: 238220 Plumbing, Heating, and Air-Conditioning Contractors.", 1, (1800, 4200)),
    ("Toyota Material Handling", "6160", "Repairs and maintenance", "Forklift repair", "811310", 1, "Repair of industrial equipment: 811310 Commercial and Industrial Machinery and Equipment Repair and Maintenance.", 1, (600, 2400)),
    ("Prologis", "6200", "Rent", "Warehouse rent", "531120", 1, "Rent to a building lessor: 531120 Lessors of Nonresidential Buildings (check the overlap with Scope 1 and 2 or category 8).", 2, (18000, 18000)),
    ("City of Fresno Utilities", "6920", "Utilities - water", "Water and sewer", "221310", 1, "Water supply: 221310 Water Supply and Irrigation Systems.", 1, (700, 1300)),
    # Energy: counted in Scope 1 or 2 from the bill; the spend line is withdrawn
    ("PG&E", "6900", "Utilities - electricity", "Electricity - plant", EN, "", "Purchased electricity is Scope 2 (and category 3 from the bill), so this spend line is withdrawn.", 3, (14000, 21000)),
    ("SoCalGas", "6910", "Utilities - natural gas", "Natural gas - plant", EN, "", "Natural gas burned on site is Scope 1 (and category 3 from the bill), so this spend line is withdrawn.", 2, (3000, 9000)),
    ("WEX Fleet", "6730", "Fuel - fleet vehicles", "Diesel fuel", EN, "", "Fleet fuel is Scope 1 mobile combustion, so this spend line is withdrawn.", 2, (1500, 4000)),
    # Freight (category 4)
    ("FedEx", "5300", "Freight in", "Inbound parcels", "492110", 4, "Parcel delivery paid by the company: 492110 Couriers and Express Delivery Services, category 4.", 4, (300, 2400)),
    ("FedEx", "5300", "Freight in", "", "492110", 4, "Blank memo; FedEx under freight in is parcel delivery: 492110, category 4.", 2, (300, 2400)),
    ("UPS", "5310", "Freight out", "Outbound parcels", "492110", 4, "Outbound parcels paid by the company are category 4: 492110 Couriers and Express Delivery Services.", 3, (300, 2400)),
    ("XPO Logistics", "5300", "Freight in", "LTL inbound", "484122", 4, "Less-than-truckload: 484122 General Freight Trucking, Long-Distance, Less Than Truckload, category 4.", 2, (1200, 7800)),
    ("J.B. Hunt Transport", "5310", "Freight out", "Truckload outbound", "484121", 4, "Truckload: 484121 General Freight Trucking, Long-Distance, Truckload, category 4 (paid by the company).", 2, (2500, 9000)),
    ("Expeditors International", "5320", "Freight forwarding and customs", "Import freight forwarding", "488510", 4, "Forwarding: 488510 Freight Transportation Arrangement, category 4.", 1, (1500, 6000)),
    ("Maersk", "5300", "Freight in", "Ocean freight container", "483111", 4, "Ocean container freight: 483111 Deep Sea Freight Transportation, category 4.", 1, (6500, 6500)),
    # Waste (category 5)
    ("Waste Management", "6800", "Waste disposal", "Monthly trash hauling", "562111", 5, "Trash collection: 562111 Solid Waste Collection, category 5.", 3, (900, 1500)),
    ("Safety-Kleen", "6810", "Hazardous waste", "Hazardous waste pickup", "562112", 5, "Hazardous waste collection: 562112, category 5.", 1, (1100, 2600)),
    ("Republic Services", "6800", "Waste disposal", "Cardboard recycling pickup", "562111", 5, "Collecting recyclables is in 562111 Solid Waste Collection, category 5.", 1, (300, 600)),
    # Travel (category 6), meals (category 1)
    ("Delta Air Lines", "6750", "Travel - airfare", "Airfare - sales team", "481111", 6, "Flights: 481111 Scheduled Passenger Air Transportation, category 6.", 4, (400, 2900)),
    ("United Airlines", "6750", "Travel - airfare", "Airfare", "481111", 6, "Flights: 481111, category 6.", 2, (400, 2900)),
    ("Marriott", "6760", "Travel - lodging", "Hotel", "721110", 6, "Hotel stays: 721110 Hotels (except Casino Hotels) and Motels, category 6.", 2, (180, 1900)),
    ("Hilton", "6760", "Travel - lodging", "Hotel stay", "721110", 6, "Hotel stays: 721110, category 6.", 2, (180, 1900)),
    ("Enterprise Rent-A-Car", "6770", "Travel - ground transportation", "Car rental", "532111", 6, "Rental cars: 532111 Passenger Car Rental, category 6.", 2, (120, 900)),
    ("Uber for Business", "6770", "Travel - ground transportation", "Rideshare", "485310", 6, "Ride-hailing is classed with taxis in NAICS 2017: 485310 Taxi Service, category 6.", 2, (40, 300)),
    ("Amtrak", "6770", "Travel - ground transportation", "Rail ticket", "482111", 6, "Intercity rail: 482111 Line-Haul Railroads (the only rail passenger code in v1.3), category 6.", 1, (90, 260)),
    ("Employee expense reports", "6780", "Travel - meals", "Meals while traveling", "722511", 1, "Meals are purchased services, not travel transport or lodging: 722511 Full-Service Restaurants, category 1.", 2, (300, 1200)),
    ("Corporate Caterers Inc", "6310", "Meals and entertainment", "Catered lunch - all hands", "722320", 1, "Catering: 722320 Caterers.", 1, (1600, 1600)),
    # Capital goods (category 2)
    ("Haas Automation", "1500", "Machinery and equipment", "CNC vertical mill VF-2", "333517", 2, "A CNC mill is a machine tool: 333517 Machine Tool Manufacturing; a fixed asset, category 2.", 1, (95000, 185000)),
    ("Toyota Material Handling", "1500", "Machinery and equipment", "Electric forklift", "333924", 2, "Forklift: 333924 Industrial Truck, Tractor, Trailer, and Stacker Machinery Manufacturing; category 2.", 1, (38000, 38000)),
    ("Dell Technologies", "1520", "Computer equipment", "Laptops (25)", "334111", 2, "Laptops: 334111 Electronic Computer Manufacturing; capitalised, category 2.", 1, (31000, 31000)),
    ("Carrier Commercial", "1600", "Building improvements", "Rooftop HVAC unit", "333415", 2, "A rooftop unit: 333415 Air-Conditioning and Warm Air Heating Equipment Manufacturing; capitalised, category 2.", 1, (42000, 42000)),
    ("Steelcase", "1700", "Furniture and fixtures", "Office desks", "337214", 2, "Steel office desks: 337214 Office Furniture (except Wood) Manufacturing; capitalised, category 2.", 1, (14000, 14000)),
    ("AutoNation Ford", "1800", "Vehicles", "Ford Transit van", "336112", 2, "A van: 336112 Light Truck and Utility Vehicle Manufacturing; capitalised, category 2.", 1, (52000, 52000)),
    # Not purchases (owner decision 8)
    ("ADP", "7000", "Salaries and wages", "Payroll funding", NP, "", "Wages paid through the payroll provider are compensation, not a purchase.", 2, (180000, 240000)),
    ("IRS - EFTPS", "7010", "Payroll taxes", "Federal payroll tax deposit", NP, "", "Payroll taxes are not a purchase.", 2, (40000, 60000)),
    ("Franchise Tax Board", "7400", "Income taxes", "CA estimated tax payment", NP, "", "Income tax is not a purchase.", 1, (25000, 25000)),
    ("Fresno County Tax Collector", "7410", "Property taxes", "Property tax installment", NP, "", "Property tax is not a purchase.", 1, (16000, 16000)),
    ("", "7500", "Depreciation expense", "Monthly depreciation", NP, "", "Depreciation is a book entry; the asset was counted when bought (category 2).", 2, (21000, 21000)),
    ("", "7510", "Amortization expense", "Software amortization", NP, "", "Amortisation is a book entry, not a purchase.", 1, (4000, 4000)),
    ("Wells Fargo", "7600", "Interest expense", "Term loan interest", NP, "", "Interest is a financing cost, not a purchase.", 2, (6000, 7000)),
    ("Wells Fargo", "7610", "Bank fees", "Monthly account service charge", NP, "", "Bank fees are not counted as a purchase (owner decision 8).", 2, (120, 400)),
    ("Acme Holdings Canada", "7700", "Intercompany", "Intercompany management fee", NP, "", "An intercompany charge is inside the group, not a purchase from a supplier.", 1, (50000, 50000)),
    ("Fidelity Investments", "7020", "Employee benefits - 401k", "401(k) employer match", NP, "", "An employer retirement contribution is compensation, not a purchase.", 2, (12000, 15000)),
]


def build_mine() -> list[list[str]]:
    random.seed(20251031)
    rows = []
    n = 0
    for vendor, account, name, memo, label, category, why, count, (low, high) in ITEMS:
        for _ in range(count):
            n += 1
            month, day = random.randint(1, 12), random.randint(1, 28)
            amount = round(random.uniform(low, high), 2)
            text = f"{amount:,.2f}" if amount >= 1000 and random.random() < 0.4 else f"{amount:.2f}"
            rows.append([f"AP-{250000 + n}", f"{month:02d}/{day:02d}/2025", vendor, account, name, memo, text, "USD", label, str(category), why])
    random.shuffle(rows)
    return rows


# The reviewer's ledger: (vendor, memo) → label, category, justification. A memo of None matches any memo of the vendor.
REVIEWER_LABELS = {
    ("Pacific Steel Supply", "Steel sheet coils"): ("331110", 1, "Steel sheet in coils is a steel-mill product: 331110 Iron and Steel Mills."),
    ("Pacific Steel Supply", "Steel bar stock"): ("331110", 1, "Hot-rolled bar stock is made at steel mills: 331110."),
    ("Pacific Steel Supply", "Cold rolled steel"): ("331221", 1, "Cold-rolling purchased steel: 331221 Rolled Steel Shape Manufacturing."),
    ("Northwest Aluminum", "Aluminum extrusions"): ("331318", 1, "Extruded aluminum: 331318 Other Aluminum Rolling, Drawing, and Extruding."),
    ("Northwest Aluminum", "Aluminum ingot"): ("331313", 1, "Primary aluminum ingot: 331313."),
    ("ResinTech Polymers", None): ("325211", 1, "Plastics resin: 325211 Plastics Material and Resin Manufacturing."),
    ("Uline", "Corrugated boxes"): ("322211", 1, "Corrugated boxes: 322211."),
    ("Uline", "Stretch wrap"): ("326112", 1, "Stretch film: 326112 Plastics Packaging Film and Sheet Manufacturing."),
    ("Uline", "Packing tape"): ("322220", 1, "Packing tape: 322220 (pressure-sensitive tape from purchased materials)."),
    ("Uline", "Credit memo damaged boxes"): ("322211", 1, "A credit for corrugated boxes: 322211 (held as a credit in any case)."),
    ("Uline", ""): ("322211", 1, "Blank memo under Packaging from a box distributor: corrugated boxes, 322211, as the main packaging bought."),
    ("Grainger", "Safety gloves"): ("339113", 1, "Personal safety equipment: 339113 Surgical Appliance and Supplies Manufacturing."),
    ("Grainger", "Fasteners"): ("332722", 1, "Fasteners: 332722."),
    ("Grainger", "Lubricants"): ("324191", 1, "Lubricants: 324191."),
    ("Grainger", None): ("332999", 1, "Unspecified MRO consumables: 332999 All Other Miscellaneous Fabricated Metal Product Manufacturing as the goods proxy (not the margin-only 423840)."),
    ("Fastenal", "Fasteners"): ("332722", 1, "Fasteners: 332722."),
    ("Fastenal", "Cutting tools"): ("333515", 1, "Cutting tools: 333515."),
    ("Staples Business Advantage", "Toner"): ("339940", 1, "Toner cartridges: 339940 Office Supplies (except Paper) Manufacturing."),
    ("Staples Business Advantage", "Paper"): ("322121", 1, "Office paper is made at paper mills: 322121."),
    ("Staples Business Advantage", "Office supplies"): ("339940", 1, "Office supplies: 339940."),
    ("Amazon Business", "Office chairs"): ("337214", 1, "Office chairs: 337214 Office Furniture (except Wood) Manufacturing."),
    ("Amazon Business", None): ("339940", 1, "Office supplies (the account) of no stated kind: 339940."),
    ("Amazon Web Services", None): ("518210", 1, "Cloud hosting: 518210 Data Processing, Hosting, and Related Services."),
    ("Microsoft", None): ("511210", 1, "Software licences: 511210 Software Publishers."),
    ("Salesforce", None): ("511210", 1, "Software subscription: 511210 Software Publishers."),
    ("ADP", None): ("541214", 1, "Payroll processing fee: 541214 Payroll Services."),
    ("Baker Lyman LLP", None): ("541110", 1, "Law firm: 541110 Offices of Lawyers."),
    ("Deloitte", None): ("541211", 1, "Audit fee: 541211 Offices of Certified Public Accountants."),
    ("Accrual - consultants", None): ("541611", 1, "Accrued consultants' fees: 541611 Administrative Management and General Management Consulting Services."),
    ("FedEx", None): ("492110", 4, "Parcels paid by the company: 492110 Couriers and Express Delivery Services, category 4."),
    ("XPO Logistics", None): ("484122", 4, "LTL freight: 484122, category 4."),
    ("Delta Air Lines", None): ("481111", 6, "Flights: 481111 Scheduled Passenger Air Transportation, category 6."),
    ("Marriott", None): ("721110", 6, "Hotel: 721110, category 6."),
    ("Enterprise Rent-A-Car", None): ("532111", 6, "Car rental: 532111 Passenger Car Rental, category 6."),
    ("Waste Management", None): ("562111", 5, "Trash hauling: 562111 Solid Waste Collection, category 5."),
    ("Sysco", None): ("311999", 1, "Food supplies for the canteen from a food distributor: the food itself, 311999 All Other Miscellaneous Food Manufacturing (Sysco's own code 424410 is the margin only)."),
    ("Cintas", None): ("812332", 1, "Uniform rental: 812332 Industrial Launderers."),
    ("Haas Automation", None): ("333517", 2, "CNC mill: 333517 Machine Tool Manufacturing, fixed asset, category 2."),
    ("Dell Technologies", None): ("334111", 2, "Laptops on a fixed-asset account: 334111 Electronic Computer Manufacturing, category 2."),
    ("PG&E", None): (EN, "", "Electricity: Scope 2 from the bill, so the spend line is withdrawn."),
    ("SoCalGas", None): (EN, "", "Natural gas: Scope 1 from the bill, so the spend line is withdrawn."),
    ("Bosch Rexroth GmbH", None): ("332912", 1, "Hydraulic valves: 332912 Fluid Power Valve and Hose Fitting Manufacturing."),
    ("Magna Components Canada", None): ("335312", 1, "Motor housings are motor parts: 335312 Motor and Generator Manufacturing."),
    ("Renishaw plc", None): ("334519", 1, "A measuring probe: 334519 Other Measuring and Controlling Device Manufacturing."),
    ("", None): ("332999", 1, "No vendor, MRO supplies account, no memo: 332999 as for other unspecified MRO consumables."),
}


def label_reviewer(vendor: str, memo: str):
    return REVIEWER_LABELS.get((vendor, memo)) or REVIEWER_LABELS[(vendor, None)]


def write(path: Path, rows: list[list[str]]) -> None:
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(HEADER + LABELS)
    writer.writerows(rows)
    path.write_text(buffer.getvalue(), encoding="utf-8")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    mine = build_mine()
    assert len(mine) == 200, len(mine)
    write(OUT / "spend-ledger-labelled-200.csv", mine)
    with open(sys.argv[1], newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        header = next(reader)
        assert header == HEADER, header
        rows = [row + [str(x) for x in label_reviewer(row[2], row[5])] for row in reader]
    assert len(rows) == 200, len(rows)
    write(OUT / "spend-ledger-reviewer-r2-labelled.csv", rows)
    print("wrote", len(mine), "and", len(rows), "labelled lines")


if __name__ == "__main__":
    main()
