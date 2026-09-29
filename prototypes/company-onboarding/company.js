// Complete 2022 NAICS sector coverage with readable labels for business intake.
// This is not a detailed establishment classification or eligibility decision.
const SECTOR_EXAMPLES = [
  ['11', 'Agriculture, forestry, fishing & hunting', 'Farms, forestry, fishing and related activities.'],
  ['21', 'Mining, quarrying & oil and gas extraction', 'Mining, quarries, oil and gas extraction and related support.'],
  ['22', 'Utilities', 'Electric power, natural gas distribution, water and sewage utilities.'],
  ['23', 'Construction', 'Building, civil engineering and specialty construction trades.'],
  ['31-33', 'Manufacturing', 'Making or processing goods, from food and textiles to chemicals and equipment.'],
  ['42', 'Wholesale trade', 'Selling goods primarily to other businesses or acting as a wholesale agent.'],
  ['44-45', 'Retail trade', 'Selling goods to consumers, including online retail.'],
  ['48-49', 'Transportation & warehousing', 'Passenger or freight transport, delivery, pipelines, storage and logistics.'],
  ['51', 'Information, media & telecommunications', 'Publishing, software publishing, broadcasting, telecommunications and data infrastructure.'],
  ['52', 'Finance & insurance', 'Banking, lending, investments, insurance and related services.'],
  ['53', 'Real estate, rental & leasing', 'Real estate services and renting or leasing property, vehicles and equipment.'],
  ['54', 'Professional, scientific & technical services', 'Legal, accounting, engineering, research, consulting and computer systems services.'],
  ['55', 'Company management & holding companies', 'Head offices, holding companies and management of other companies or enterprises.'],
  ['56', 'Business support, waste & remediation services', 'Administrative support, staffing, cleaning, security, waste management and remediation.'],
  ['61', 'Education', 'Schools, colleges, training and educational support services.'],
  ['62', 'Healthcare & social assistance', 'Healthcare providers, residential care, childcare and social assistance.'],
  ['71', 'Arts, entertainment & recreation', 'Performing arts, museums, spectator sports, recreation and amusement.'],
  ['72', 'Accommodation & food services', 'Hotels, other accommodation, restaurants, catering and food services.'],
  ['81', 'Other services: repair, personal & membership', 'Repair and maintenance, personal services, religious and membership organizations, and private households employing service workers.'],
  ['92', 'Public administration', 'Government administration and public programs.'],
];
const BUSINESS_SECTORS=CompanyValidation.sectors.map(row=>[row.code,row.title,SECTOR_EXAMPLES.find(s=>s[0]===row.code)?.[2]||'']);
const SECTOR_OPTIONS = [...BUSINESS_SECTORS.map(s => s[1]), 'Other'];
let companyAttempted = false;
const companyTouched=new Set();
let naicsQuery='',naicsPage=0,naicsOpen=false;
const COMPANY_FIELDS = {
  legal: {label:'Legal company name', limit:200, help:'Use the registered name of the reporting company (2–200 characters).'},
  trading: {label:'Trading name', limit:200, optional:true, help:'If different from the legal name. Also called a DBA or business name.'},
  country: {label:'Headquarters country or territory', limit:100, help:'Enter the country or territory of your main headquarters.'},
  region: {label:'Headquarters city and state / region', limit:200, optional:true, help:'For example, the city and province, state or region. No street address is needed.'},
  industry: {label:'Main business activity', limit:200, help:'Choose the closest match for the reporting company. Add other activities below if your business spans sectors.'},
  other: {label:'Describe your main business activity', limit:600, help:'Explain what the business makes or does so a reviewer can understand the activity.'},
  additional: {label:'Additional business activities', limit:600, optional:true, help:'List other significant activities or business lines, if any. For nonprofits, choose by activity, such as education or healthcare.'},
  naics: {label:'NAICS code', limit:6, optional:true, help:'Enter an existing six-digit 2022 U.S. industry code, or search by what your company does.'},
  role: {label:'Preparer / contact role', limit:120, optional:true, help:'The role responsible for this setup, such as facilities manager or sustainability lead. Enter a role, not personal contact details.'},
};
function companyErrors(company) { return CompanyValidation.errors(company); }
function companyControl(key) {
  const config = COMPANY_FIELDS[key];
  const value = get('company.' + key);
  const id = 'company-' + key;
  const error = companyAttempted || companyTouched.has(key) ? companyErrors(data.company)[key] : '';
  const attributes = `id="${id}" data-path="company.${key}" aria-describedby="${id}-help ${id}-error" ${config.optional?'':'aria-required="true"'} ${error?'aria-invalid="true"':''} maxlength="${config.limit}" autocomplete="off" ${key==='naics'?'inputmode="numeric"':''}`;
  let input;
  if (key === 'industry') {
    const legacy = value && !SECTOR_OPTIONS.includes(value) ? `<option value="${esc(value)}" selected>Previous answer: ${esc(value)} — choose a current option</option>` : '';
    input = `<select ${attributes}><option value="">Choose a business activity</option>${legacy}${SECTOR_OPTIONS.map(option=>`<option value="${esc(option)}" ${value===option?'selected':''}>${esc(option)}</option>`).join('')}</select>`;
  } else if (key === 'other' || key === 'additional') input = `<textarea ${attributes} rows="3">${esc(value)}</textarea>`;
  else input = `<input ${attributes} type="text" value="${esc(value)}">`;
  const example = key === 'industry' ? BUSINESS_SECTORS.find(s => s[1] === value)?.[2] : '';
  return `<div class="field ${['industry','other','additional'].includes(key)?'full':''}"><label for="${id}">${config.label}${config.optional?' <span class="optional">(optional)</span>':' <span class="required-marker" aria-hidden="true">*</span>'}</label>${input}<small id="${id}-help">${esc(example || config.help)}</small><span class="field-error" id="${id}-error">${esc(error)}</span></div>`;
}
function companySection() {
  const errors = companyErrors(data.company);
  const errorSummary = companyAttempted && Object.keys(errors).length ? `<div class="error-summary" tabindex="-1" id="company-errors"><strong>Check the highlighted fields before continuing.</strong><ul>${Object.entries(errors).map(([k,v])=>`<li><a href="#company-${k}">${esc(COMPANY_FIELDS[k].label)}: ${esc(v)}</a></li>`).join('')}</ul></div>` : '';
  return section(0, `<p class="required-note">Fields marked * are required. Optional fields can stay blank.</p>${errorSummary}${grid(companyControl('legal') + companyControl('trading') + companyControl('country') + companyControl('region') + companyControl('industry') + (get('company.industry')==='Other'?companyControl('other'):'') + companyControl('additional') + companyControl('role'))}${naicsLookup()}<details><summary>About the business activity list</summary><p>The list covers all 20 broad sectors in the 2022 North American Industry Classification System, with the official Census sector names. California EDD also uses NAICS. You can choose a sector without knowing a detailed code. “Other” lets you describe an activity that does not fit a listed choice.</p><p>Industry classification describes the business. It does not determine reporting obligations or which emissions belong in your inventory. <a href="https://www.census.gov/programs-surveys/economic-census/year/2022/guidance/understanding-naics.html" target="_blank" rel="noreferrer">U.S. Census sector reference ↗</a> · <a href="https://labormarketinfo.edd.ca.gov/LMID/NAICS.html" target="_blank" rel="noreferrer">California EDD classification guidance ↗</a></p></details>`, 'Identify the reporting company and what it does. Related entities and operating sites come in the next sections.');
}
function refreshCompanyErrors() {
  const errors = companyErrors(data.company);
  for (const key of Object.keys(COMPANY_FIELDS)) {
    const input = document.querySelector('#company-' + key);
    const message = document.querySelector('#company-' + key + '-error');
    const visible=companyAttempted||companyTouched.has(key);
    if (input) input.setAttribute('aria-invalid', visible&&errors[key]?'true':'false');
    if (message) message.textContent = visible ? errors[key] || '' : '';
  }
  const summary = document.querySelector('#company-errors');
  if (summary) {
    const list=summary.querySelector('ul');
    if(list)list.innerHTML=Object.entries(errors).map(([k,v])=>`<li><a href="#company-${k}">${esc(COMPANY_FIELDS[k].label)}: ${esc(v)}</a></li>`).join('');
    summary.hidden = !Object.keys(errors).length;
  }
}

function naicsResults(){
  const matches=CompanyValidation.searchNaics(naicsQuery);
  const size=12;const pages=Math.max(1,Math.ceil(matches.length/size));naicsPage=Math.min(naicsPage,pages-1);
  return `<p role="status" class="required-note">${matches.length?`${matches.length.toLocaleString()} matching industries · ${naicsPage*size+1}–${Math.min((naicsPage+1)*size,matches.length)} shown`:'No matching industries. Try a broader term or code. You may leave NAICS blank and describe the activity under Other.'}</p><div class="naics-results">${matches.slice(naicsPage*size,(naicsPage+1)*size).map(row=>`<button type="button" data-naics="${row.code}"><strong>${row.code}</strong><span>${esc(row.title)}</span></button>`).join('')}</div>${matches.length>size?`<div class="naics-pages"><button type="button" data-naics-page="-1" ${naicsPage===0?'disabled':''}>Previous results</button><span>Page ${naicsPage+1} of ${pages}</span><button type="button" data-naics-page="1" ${naicsPage===pages-1?'disabled':''}>Next results</button></div>`:''}`;
}
function naicsSelection(){
  const code=get('company.naics').trim();const match=CompanyValidation.findCode(code);
  return match?`${match.code} · ${match.title}`:code?'No matching 2022 six-digit code selected.':'No detailed code selected. You can complete this page without one.';
}
function naicsLookup(){return `<div class="card naics-card"><div class="cardhead"><h3>Industry code <span class="optional">(optional)</span></h3></div>${companyControl('naics')}<p id="naics-match" role="status" class="required-note">${esc(naicsSelection())}</p><button type="button" id="clear-naics" class="text" ${!get('company.naics')?'hidden':''}>Clear NAICS code</button><details id="naics-lookup" ${naicsOpen?'open':''}><summary>Find a NAICS code by name or number</summary><p>Search all 1,012 detailed industries from the official 2022 U.S. Census list. Choosing a result also sets the main business activity above.</p><label class="field" for="naics-search">Search industry names or codes</label><input id="naics-search" type="search" value="${esc(naicsQuery)}" maxlength="100" placeholder="For example: restaurant, software, 541330" aria-controls="naics-results" autocomplete="off"><div id="naics-results">${naicsResults()}</div></details></div>`;}
document.addEventListener('toggle',event=>{if(event.target.id==='naics-lookup')naicsOpen=event.target.open;},true);
document.addEventListener('input',event=>{
  if(event.target.id==='naics-search'){naicsQuery=event.target.value;naicsPage=0;document.querySelector('#naics-results').innerHTML=naicsResults();}
  if(event.target.id==='company-naics'){const match=CompanyValidation.findCode(event.target.value.trim());document.querySelector('#naics-match').textContent=match?`${match.code} · ${match.title}`:'No matching 2022 six-digit code selected.';document.querySelector('#clear-naics').hidden=!event.target.value;}
});
document.addEventListener('click',event=>{
 const button=event.target.closest('button');if(!button)return;
 if(button.dataset.naics){const match=CompanyValidation.findCode(button.dataset.naics);if(!match)return;data.company.naics=match.code;data.company.industry=CompanyValidation.sectorTitle(match.sector);data.review={};naicsOpen=true;save();render();document.querySelector('#company-naics').focus();}
 if(button.id==='clear-naics'){data.company.naics='';data.review={};save();render();document.querySelector('#company-naics').focus();}
 if(button.dataset.naicsPage){naicsPage+=Number(button.dataset.naicsPage);document.querySelector('#naics-results').innerHTML=naicsResults();document.querySelector('#naics-results button')?.focus();}
});

document.addEventListener('focusout',event=>{const path=event.target.dataset?.path;if(path?.startsWith('company.')){companyTouched.add(path.split('.')[1]);refreshCompanyErrors();}});
