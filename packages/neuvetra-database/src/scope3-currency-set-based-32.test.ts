// BF-20: the differential suite of scope3-currency-set-based.test.ts on PGlite at schema 32 (0032, which the owner applies
// after BF-21; the conversion must behave identically on 31 and 32). A file of its own so only one PGlite instance is open.
import { pgliteAt, registerDifferentialSuite } from './scope3-currency-differential.fixture'

registerDifferentialSuite('PGlite schema 32', () => pgliteAt(32))
