# M80 local publication check correction

The 46-file index matched the byte-pinned publication manifest. The full staged whitespace check then flagged one trailing blank line in each of two already reviewed artifacts: the navigation candidate1 snapshot and historical pause note. The PowerShell invocation continued to create local commit525ba6b9 after its Python validation subprocess failed. No push, PR creation or deployment occurred from that invocation.

Preserve both frozen files exactly. Add only two path-specific `whitespace=-blank-at-eof` attributes, leaving all other whitespace checks active. This is formatting policy for immutable evidence, not a source/content change. Recheck the complete diff against merged base e10012bc and exact manifest bytes before publication. Subsequent dependent validation/commit operations use one Python process with checked subprocesses so a failed check prevents commit.
