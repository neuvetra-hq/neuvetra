/**
 * The curated GL-account and description term map for spend NAICS suggestions (round 3 lane C, owner decision 8; Claude,
 * 31 October 2026). Committed and reviewed: each entry names what a ledger phrase means as a 2017 NAICS code of the EPA
 * Supply Chain GHG Emission Factors v1.3 (the sector that makes the goods or provides the service, never a wholesaler's or
 * retailer's code, which the EEIO data treats as the trade margin only), or that the line is not a purchase, or that it
 * is an energy bill counted in Scope 1 or 2. A test checks that every code here is a v1.3 code.
 *
 * Matching is by whole words (a word also matches its plural with "s" or "es"); a longer phrase that covers a shorter one
 * in the same text wins over it. Phrases are written in lower case with single spaces.
 */

export type Scope3SpendWithdrawKind = "not_a_purchase" | "energy"
/** `generic`: an account-level word ("freight", "packaging", "maintenance", "marketing") that yields to a specific term
 * anywhere in the line (a vendor that is a courier says more than an account called "Freight in"). */
export interface Scope3SpendTerm { phrases: readonly string[]; naics?: string; withdraw?: Scope3SpendWithdrawKind; why: string; generic?: true }

const t = (naics: string, why: string, ...phrases: string[]): Scope3SpendTerm => ({ naics, why, phrases })
const g = (naics: string, why: string, ...phrases: string[]): Scope3SpendTerm => ({ naics, why, phrases, generic: true })
const out = (withdraw: Scope3SpendWithdrawKind, why: string, ...phrases: string[]): Scope3SpendTerm => ({ withdraw, why, phrases })

export const SCOPE3_SPEND_TERMS: readonly Scope3SpendTerm[] = [
  // --- Not purchases (owner decision 8) and energy bills (Scope 1 or 2) ---
  out("not_a_purchase", "wages and salaries are compensation", "salaries", "salary", "wages", "wage", "payroll funding", "net pay", "bonus", "bonuses", "commissions paid", "payroll journal", "payroll run"),
  out("not_a_purchase", "taxes are not purchases", "payroll tax", "payroll taxes", "income tax", "income taxes", "property tax", "property taxes", "franchise tax", "estimated tax", "sales tax", "use tax", "excise tax", "tax payment", "tax deposit", "eftps", "irs", "tax collector", "taxes and licenses"),
  out("not_a_purchase", "depreciation and amortisation are book entries", "depreciation", "amortization", "amortisation", "accumulated depreciation"),
  out("not_a_purchase", "interest is a financing cost", "interest", "interest expense", "loan interest", "finance charge", "finance charges"),
  out("not_a_purchase", "bank fees are not counted as purchases", "bank fee", "bank fees", "bank charge", "bank charges", "bank service charge", "account service charge", "wire fee", "wire fees", "overdraft"),
  out("not_a_purchase", "intercompany charges stay inside the group", "intercompany", "inter company", "due to affiliate", "due from affiliate"),
  out("not_a_purchase", "employer retirement contributions are compensation", "401k", "401 k", "employer match", "retirement contribution", "pension contribution"),
  out("energy", "an electricity, gas or fuel bill is counted in Scope 1 or 2 (and category 3) from the bill", "electricity", "electric bill", "electric utility", "utilities electricity", "utilities electric", "natural gas", "utilities gas", "diesel", "gasoline", "fuel card", "fleet fuel", "fuel fleet", "propane", "fuel oil", "heating oil", "kerosene", "steam purchased", "district heating"),

  // --- Purchases that look like the words above ---
  t("541214", "payroll processing is a purchased service", "payroll processing", "payroll services", "payroll service", "payroll fee", "payroll processing fee", "paychex", "adp", "gusto"),
  t("541213", "tax return preparation is a purchased service", "tax preparation", "tax return preparation", "tax return", "tax returns", "tax advisory", "tax services", "tax compliance services"),

  // --- Freight (category 4) ---
  t("492110", "parcels and couriers", "parcel", "parcels", "courier", "couriers", "express delivery", "overnight shipping", "fedex", "ups", "dhl", "next day air"),
  t("491110", "postage", "postage", "usps", "stamps"),
  t("484122", "less-than-truckload freight", "ltl", "less than truckload"),
  t("484121", "truckload freight", "truckload", "ftl", "full truckload"),
  g("484121", "freight by truck", "freight", "freight in", "freight out", "inbound freight", "outbound freight", "trucking", "shipping", "carriage", "haulage"),
  t("484110", "local trucking", "drayage", "local delivery", "local trucking"),
  t("488510", "freight forwarding and customs brokerage", "freight forwarding", "forwarding", "forwarder", "customs broker", "customs brokerage", "freight arrangement"),
  t("483111", "ocean freight", "ocean freight", "sea freight", "container freight", "ocean", "maersk"),
  t("481112", "air freight", "air freight", "air cargo"),
  t("482111", "rail freight", "rail freight"),
  t("493110", "warehousing", "warehousing", "storage fees", "3pl", "fulfillment"),

  // --- Waste (category 5) ---
  t("562111", "waste and recyclables collection", "trash", "garbage", "refuse", "waste", "waste hauling", "trash hauling", "dumpster", "recycling", "recyclables", "waste disposal", "waste removal"),
  t("562112", "hazardous waste collection", "hazardous waste", "haz waste", "hazmat disposal", "used oil pickup", "safety kleen"),
  t("562212", "landfill", "landfill", "tipping fee", "tipping fees"),

  // --- Travel (category 6) and meals (category 1) ---
  t("481111", "flights", "airfare", "air fare", "flight", "flights", "airline", "airlines", "air lines", "air travel", "plane ticket", "travel airfare"),
  t("721110", "hotel stays", "hotel", "hotels", "lodging", "motel", "marriott", "hilton", "hyatt", "travel lodging"),
  t("532111", "rental cars", "car rental", "rental car", "rent a car", "hertz", "avis"),
  t("485310", "taxis and ride-hailing", "taxi", "taxis", "rideshare", "ride share", "uber", "lyft", "cab"),
  t("485320", "car services", "limo", "limousine", "car service"),
  t("482111", "rail travel", "rail ticket", "train ticket", "train", "amtrak"),
  t("722511", "meals", "meals", "meal", "restaurant", "restaurants", "dinner", "client entertainment", "travel meals"),
  t("722320", "catering", "catering", "catered", "caterer", "caterers"),
  t("311999", "food supplies", "canteen", "food supplies", "groceries", "snacks"),
  t("311920", "coffee", "coffee", "coffee service"),

  // --- Capital goods and equipment ---
  t("333517", "machine tools", "cnc", "machine tool", "lathe", "milling machine", "vertical mill", "machining center"),
  t("333924", "forklifts", "forklift", "electric forklift", "pallet jack", "lift truck"),
  t("334111", "computers", "laptop", "laptops", "notebook computer", "desktop computer", "computers", "server", "servers", "computer equipment"),
  t("334118", "computer peripherals", "monitor", "monitors", "docking station", "docking stations", "keyboard", "keyboards", "printer", "printers", "peripherals", "computer hardware"),
  t("333415", "HVAC equipment", "rooftop unit", "rooftop hvac unit", "hvac unit", "air conditioner", "air handler", "heat pump"),
  t("337214", "non-wood office furniture", "office furniture", "desk", "desks", "chair", "chairs", "office chairs", "workstations", "cubicles", "furniture and fixtures", "furniture"),
  t("336112", "vans and light trucks", "van", "vans", "pickup truck", "suv", "light truck"),

  // --- Materials and components ---
  t("331110", "steel-mill products", "steel", "hot rolled", "steel coil", "steel coils", "sheet coils", "steel bar", "bar stock", "steel plate", "rebar"),
  t("331221", "cold-rolled or cold-drawn steel", "cold rolled", "cold drawn", "cold rolled steel", "cold rolled steel sheet"),
  t("331210", "steel pipe and tube", "steel tube", "steel pipe", "steel tubing"),
  t("331313", "primary aluminum", "aluminum ingot", "aluminium ingot", "primary aluminum"),
  t("331318", "aluminum extrusions", "aluminum", "aluminium", "aluminum extrusions", "extrusions", "extruded aluminum"),
  t("331315", "aluminum sheet, plate and foil", "aluminum sheet", "aluminum plate", "aluminum foil", "aluminum coil"),
  t("331420", "copper wire, rod and tube", "copper", "copper wire", "bare copper", "copper rod", "copper tubing"),
  t("335929", "insulated wire and cable", "cable", "insulated cable", "power cable", "insulated wire", "electrical wire", "wire and cable"),
  t("325211", "plastics resin", "resin", "resins", "pellets", "polypropylene", "polyethylene", "abs", "nylon resin", "plastics raw material", "raw materials plastics"),
  t("332912", "fluid power valves", "valve", "valves", "hydraulic valves", "hose fittings"),
  t("333995", "fluid power cylinders", "hydraulic cylinder", "hydraulic cylinders", "pneumatic cylinder", "actuator", "actuators"),
  t("333996", "fluid power pumps", "hydraulic pump", "hydraulic pumps"),
  t("334412", "bare printed circuit boards", "pcb", "pcbs", "printed circuit board", "printed circuit boards", "bare board", "bare boards"),
  t("334418", "printed circuit assemblies", "pcba", "circuit board assembly", "loaded board"),
  t("335314", "relays and industrial controls", "relay", "relays", "contactor", "contactors", "motor starter", "plc", "industrial controls"),
  t("334417", "connectors", "connector", "connectors"),
  t("332722", "fasteners", "fastener", "fasteners", "bolt", "bolts", "nut", "nuts", "screw", "screws", "washer", "washers", "rivet", "rivets"),
  t("326220", "belts and hoses", "v belt", "v belts", "belt", "belts", "hose", "hoses"),
  t("322211", "corrugated boxes", "corrugated", "box", "boxes", "carton", "cartons", "shipping boxes"),
  g("322211", "packaging (corrugated boxes as the usual packaging bought)", "packaging"),
  t("326112", "plastic packaging film", "stretch wrap", "stretch film", "shrink wrap", "poly bags", "plastic film"),
  t("322220", "packing tape", "packing tape", "tape"),
  t("321920", "pallets", "pallet", "pallets", "skids", "crates"),
  t("325510", "paint and coatings", "paint", "coating", "coatings", "powder coat", "powder coating", "primer"),
  t("325120", "industrial gases", "argon", "nitrogen", "oxygen", "helium", "welding gas", "industrial gas", "gas cylinders", "co2 cylinders"),
  t("333992", "welding equipment", "welder", "mig welder", "welding machine", "welding equipment", "welding wire", "welding supplies"),
  t("339113", "personal safety equipment", "safety gloves", "gloves", "ppe", "safety glasses", "hard hats", "respirators", "safety supplies"),
  t("324191", "lubricants", "lubricant", "lubricants", "grease", "cutting oil", "cutting fluid"),
  t("333515", "cutting tools", "cutting tool", "cutting tools", "drill bits", "end mill", "end mills", "carbide inserts", "taps", "tooling"),
  t("327910", "abrasives", "grinding wheel", "grinding wheels", "abrasive", "abrasives", "sandpaper", "sanding discs"),
  t("332991", "bearings", "bearing", "bearings", "ball bearings"),
  t("332999", "unspecified MRO consumables (the goods, not the distributor's margin)", "mro", "mro supplies", "shop supplies", "maintenance supplies", "industrial supplies", "consumables"),
  t("335312", "motors and motor parts", "motor housing", "motor housings", "electric motor", "electric motors", "motors"),
  t("334519", "measuring devices", "probe", "probes", "probe kit", "gauge", "gauges", "calipers", "metrology", "sensor", "sensors"),

  // --- Office ---
  t("339940", "office supplies", "office supplies", "toner", "toner cartridges", "ink cartridges", "cartridges", "pens", "misc supplies", "miscellaneous supplies"),
  t("322121", "paper", "copy paper", "printer paper", "paper"),

  // --- IT and telecom ---
  t("518210", "cloud hosting and data processing", "aws", "cloud hosting", "hosting", "cloud", "iaas", "data center", "colocation", "azure", "google cloud", "web services"),
  t("511210", "software", "software", "license", "licenses", "licence", "licences", "subscription", "saas", "m365", "microsoft 365", "office 365", "crm", "creative cloud", "video conferencing"),
  t("541512", "IT systems design and implementation", "it consulting", "erp implementation", "systems integration", "implementation consulting", "managed services", "it services"),
  t("541511", "custom programming", "custom software development", "software development", "programming"),
  t("517312", "wireless service", "mobile", "wireless", "cell phone", "cell phones", "mobile phone", "mobile phone service"),
  t("517311", "wired telecom and internet", "internet", "internet service", "broadband", "phone lines", "telephone", "fiber", "isp", "landline"),

  // --- Professional services ---
  t("541110", "legal services", "legal", "legal fees", "attorney", "attorneys", "counsel", "law firm", "contract review", "patent", "patents", "patent filing", "trademark", "litigation"),
  t("541211", "audit and accounting", "audit", "audit fee", "annual audit", "cpa", "accounting services", "bookkeeping"),
  t("561320", "temporary staff", "temp", "temps", "temporary staff", "temporary staffing", "temporary help", "staffing", "contract labor", "temp labor"),
  t("561312", "executive search", "executive search"),
  t("561311", "recruiting and placement", "recruiting", "recruitment", "recruiting fee", "placement fee", "headhunter"),
  t("541810", "advertising agencies", "advertising", "ad campaign", "marketing agency", "media buying", "campaign management", "digital marketing"),
  g("541810", "marketing services", "marketing"),
  t("323111", "printing", "printing", "brochures", "brochure", "printed", "business cards", "flyers"),
  t("561920", "trade shows and conferences", "trade show", "trade shows", "conference registration", "exhibition", "expo"),
  t("541611", "management consulting", "consulting", "consultant", "consultants", "advisory", "strategy consulting", "management consulting"),
  t("541620", "environmental consulting", "environmental consulting", "environmental compliance", "environmental compliance consulting", "ehs consulting", "sustainability consulting"),
  t("541330", "engineering services", "engineering services", "design engineering"),
  t("541380", "testing laboratories", "testing", "lab testing", "product testing", "product safety testing", "certification", "inspection"),
  t("524126", "property and casualty insurance", "insurance", "insurance premium", "liability insurance", "property insurance", "workers comp", "workers compensation", "auto insurance", "general liability"),
  t("524114", "health insurance", "health insurance", "medical insurance", "group health", "health premium", "dental insurance", "vision insurance", "employee health insurance"),
  t("524113", "life insurance", "life insurance"),
  t("524210", "insurance brokers", "brokerage fee", "insurance broker", "insurance brokerage", "insurance brokerage fee"),

  // --- Facilities ---
  t("812332", "uniform and linen rental", "uniform rental", "uniforms", "uniform", "linen", "mat service", "shop towels", "laundry"),
  t("561720", "janitorial services", "janitorial", "cleaning", "custodial", "office cleaning"),
  t("561612", "security guards", "security guard", "security guards", "guard services", "security services", "security guard services", "patrol"),
  t("561621", "alarm and security systems", "alarm monitoring", "security system"),
  t("561730", "landscaping", "landscaping", "grounds maintenance", "lawn", "snow removal"),
  t("238220", "HVAC and plumbing contractors", "hvac", "hvac maintenance", "hvac maintenance contract", "plumbing", "air conditioning service"),
  t("238210", "electrical contractors", "electrician", "electrical repair", "electrical contractor"),
  t("811310", "repair of commercial and industrial machinery", "equipment repair", "machine repair", "forklift repair", "service call"),
  g("811310", "repair and maintenance of machinery", "repair", "repairs", "maintenance"),
  t("531120", "rent of non-residential buildings", "rent", "warehouse rent", "office rent", "building lease", "lease payment"),
  t("221310", "water supply", "water", "water and sewer", "water bill"),
]

/**
 * What a GL account name (and, for capital assets, its code) says about the Scope 3 category: fixed assets → 2, freight and
 * shipping → 4, waste → 5, travel → 6. Shown for confirmation; a code outside the category's set keeps category 1.
 */
export const SCOPE3_SPEND_ACCOUNT_CATEGORY: ReadonlyArray<{ category: 2 | 4 | 5 | 6; phrases: readonly string[]; assetAccountOnly?: true; why: string }> = [
  { category: 2, why: "a fixed-asset (capital) account", phrases: ["fixed asset", "fixed assets", "capital", "capex", "capitalized", "capitalised", "construction in progress", "cip", "machinery and equipment", "building improvements", "leasehold improvements", "furniture and fixtures"] },
  { category: 2, why: "an asset account (a balance-sheet code) for equipment", assetAccountOnly: true, phrases: ["equipment", "machinery", "computer equipment", "vehicles", "vehicle", "furniture", "buildings", "improvements", "tooling"] },
  { category: 4, why: "a freight or shipping account", phrases: ["freight", "shipping", "postage", "delivery", "courier", "logistics", "forwarding", "customs", "carriage", "inbound freight", "outbound freight"] },
  { category: 5, why: "a waste account", phrases: ["waste", "trash", "garbage", "recycling", "disposal", "hazardous waste"] },
  { category: 6, why: "a travel account", phrases: ["travel", "airfare", "lodging", "hotel", "ground transportation", "mileage"] },
]
