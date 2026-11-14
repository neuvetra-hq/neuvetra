// BF-14: the message after a currency conversion names lines skipped because the rate date is in another year from the line.
import { describe, expect, test } from "bun:test"
import { SPEND_TEXT_R3C } from "./scope3-text-r3c"
import { reasonText, reasonTextKnown } from "../../../../packages/neuvetra-database/src/plain-language-labels"

describe("BF-14: conversion messages", () => {
  test("a line skipped for its year says why and what to do; the older skip reasons keep their words", () => {
    const text = SPEND_TEXT_R3C.converted(2, "EUR", "1.0823", "ECB", "2025-06-30", [{ sourceId: "FX-6", reason: "rate_date_outside_line_year" }, { sourceId: "FX-3", reason: "negative_amount_not_supported" }, { sourceId: "FX-9", reason: "amount_not_a_number" }])
    expect(text).toBe("2 EUR lines converted to US dollars at 1.0823 USD per EUR (ECB, 2025-06-30). 3 lines not converted: FX-6 (the rate date is in a different year from the line; convert that year at its own rate), FX-3 (a credit or refund), FX-9 (not a plain amount).")
  })
  test("the hold reason has reviewed words that say what to do", () => {
    expect(reasonTextKnown("currency_rate_outside_line_year")).toBe(true)
    expect(reasonText("currency_rate_outside_line_year")).toContain("convert that currency again with a rate dated in the line’s own year")
  })
})
