"""Build the synthetic planning fragment from its reviewed scenario and template."""
import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--output', default='docs/prototypes/m70-coverage-planner.html')
parser.add_argument('--standalone', action='store_true')
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
template = (root / 'docs/prototypes/m70-coverage-planner.template.html').read_text(encoding='utf-8')
scenario = json.loads((root / 'docs/research/m70-demo-scenario.json').read_text(encoding='utf-8'))
assert template.count('__M70_SCENARIO__') == 1
assert [c['category'] for c in scenario['scope3_categories']] == list(range(1, 16))
encoded = json.dumps(scenario, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
output = Path(args.output)
output.parent.mkdir(parents=True, exist_ok=True)
fragment = template.replace('__M70_SCENARIO__', encoded)
if args.standalone:
    fragment = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Neuvetra coverage planning</title></head><body>' + fragment + '</body></html>\n'
output.write_text(fragment, encoding='utf-8', newline='\n')
print(str(output.resolve()))
