import { readFile } from 'fs/promises';

const ENDPOINT = 'http://localhost:3000/enrich';
const casesPath = new URL('./cases.json', import.meta.url).pathname;

const cases = JSON.parse(await readFile(casesPath, 'utf-8'));

let correct = 0;
const failures = [];

for (const testCase of cases) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testCase.input),
  });
  const body = await res.json();

  const categoryMatch = body.category === testCase.expected_category;
  const flagMatch = testCase.expect_flag ? body.quality_flags?.includes(testCase.expect_flag) : true;
  const confidenceMatch = testCase.expect_low_confidence ? body.confidence < 0.5 : true;

  const passed = categoryMatch && flagMatch && confidenceMatch;
  if (passed) {
    correct += 1;
  } else {
    failures.push({
      id: testCase.id,
      note: testCase.note,
      expected_category: testCase.expected_category,
      got_category: body.category,
      expected_flag: testCase.expect_flag || null,
      got_flags: body.quality_flags,
      got_confidence: body.confidence,
    });
  }

  console.log(`[${testCase.id}] ${passed ? 'PASS' : 'FAIL'} — ${testCase.note}`);
}

console.log(`\nScore: ${correct}/${cases.length}`);
if (failures.length > 0) {
  console.log('\nFailures:');
  console.log(JSON.stringify(failures, null, 2));
}