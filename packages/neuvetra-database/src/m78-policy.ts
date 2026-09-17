import type {M78Policy} from './m78-contract'
/** Exact descriptor approved only for bounded synthetic numerical compatibility. */
export const M78_FUGITIVE_METHOD={
  "id": "m77-stable-serviced-equipment-2025-candidate-v1",
  "engineSha256": "3c81c8d1b4ee6b2435765013d0578021556b70d35f16e4512ebecf1c873f25b4",
  "sourceSha256": "43afb91d79b2ae765b3a447549d9e1021a144a407cec5eb804be9fcf69a668a7",
  "guidanceSha256": "fb3dd5c9677096094c2acef769c7fe2fb90def6feac403cf9c817f5810928d88",
  "gwpBasis": "EPA January 2025 Hub; AR5 100-year published value",
  "gases": [
    {
      "gas": "HFC-134a",
      "gwp": "1300",
      "gasKind": "single_gas",
      "locator": "Emission Factors Hub!E532"
    },
    {
      "gas": "HFC-227ea",
      "gwp": "3350",
      "gasKind": "single_gas",
      "locator": "Emission Factors Hub!E538"
    },
    {
      "gas": "R-410A",
      "gwp": "1924",
      "gasKind": "blend",
      "locator": "Emission Factors Hub!D575"
    }
  ],
  "status": "development_candidate_not_released",
  "releaseEligible": false,
  "factorGwpDescriptor": {
    "sourceSha256": "43afb91d79b2ae765b3a447549d9e1021a144a407cec5eb804be9fcf69a668a7",
    "assessment": "IPCC AR5",
    "horizonYears": "100",
    "gases": [
      {
        "gas": "HFC-134a",
        "gwp": "1300",
        "gasKind": "single_gas",
        "locator": "Emission Factors Hub!E532"
      },
      {
        "gas": "HFC-227ea",
        "gwp": "3350",
        "gasKind": "single_gas",
        "locator": "Emission Factors Hub!E538"
      },
      {
        "gas": "R-410A",
        "gwp": "1924",
        "gasKind": "blend",
        "locator": "Emission Factors Hub!D575"
      }
    ]
  },
  "factorGwpDescriptorSha256": "80a514d4596fc214ea3086941b37377f9e939f7541e40590fa4ee243deb1e24d"
} as const

export const M78_REVIEWED_POLICY:M78Policy={
  "id": "m78-scope1-compatible-candidate-v1",
  "status": "accounting_reviewed_candidate",
  "releaseEligible": false,
  "reviewArtifact": {
    "path": "evaluations/research-qa/m78-accounting-review.md",
    "sha256": "5d5b04d73266e4954ccd9cdc29595a2ed9c6446e255de9fd987a2e2a262dc69c"
  },
  "methods": [
    {
      "family": "natural_gas",
      "methodSha256": "a596ea0d377f33ac34e1333852c313c855c2a18ac08006525a78bbfb7cce9898"
    },
    {
      "family": "mobile_diesel",
      "methodSha256": "7598384902729e8a6708beb359e7564f500ad85c0d3ad38f094ee580a05c0497"
    },
    {
      "family": "stationary_diesel",
      "methodSha256": "8924b6c99a7b2b1525f2f2ef641978bbdfc5c7116c40a9fc828e418e56a4a722"
    },
    {
      "family": "fugitive",
      "methodSha256": "acbfed90deaf7c164fe889b87732a998396ace265c92973ba3f79c6a71c038af"
    }
  ],
  "gasGwps": [
    {
      "gas": "CO2",
      "gwp": "1",
      "gasKind": "single_gas"
    },
    {
      "gas": "CH4",
      "gwp": "28",
      "gasKind": "single_gas"
    },
    {
      "gas": "N2O",
      "gwp": "265",
      "gasKind": "single_gas"
    },
    {
      "gas": "HFC-134a",
      "gwp": "1300",
      "gasKind": "single_gas"
    },
    {
      "gas": "HFC-227ea",
      "gwp": "3350",
      "gasKind": "single_gas"
    },
    {
      "gas": "R-410A",
      "gwp": "1924",
      "gasKind": "blend"
    }
  ],
  "blendDisclosure": "opaque_blend_no_constituent_guess",
  "rounding": "half_even_4dp",
  "policySha256": "83588037114ca6e688a221a4027dab1e480ad898aa29d2bcbeaec24ad9dcb303"
}
