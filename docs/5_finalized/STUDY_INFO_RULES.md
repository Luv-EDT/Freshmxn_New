# Study information — the rules behind it

**Written for:** the owner and whoever reviews the data. It says what each study-related line on a career
card means, where the value came from, and how sure we are. Generated from the data files on 3 October 2026
(Round 12) — if a table here and a file disagree, the file is right; regenerate this page.

**The three labels used everywhere below and on the card:**
| Label | Meaning | Card shows |
|---|---|---|
| **Checked** | an official rule says so (a regulator, UGC, UPSC or a recruitment notice), cited | "Checked against the official rules, Oct 2026" |
| **Published evidence** | a published study, job-market or course information supports it; it is not a rule | "Based on published information, Oct 2026" |
| **Our judgement** | no source looked up; Claude's judgement of how the career is entered | "Our estimate" |

The sources live in `Backend/data/study_sources.json`. Every month the study bot re-checks up to 10 of these
careers on official and academic Indian websites (`gov.in`, `nic.in`, `ac.in`, `res.in`, `edu.in`) and proposes
changes with their sources; nothing changes until the admin approves it in **Data updates**.

Neither field is used to rank careers. Matching never reads them.

---

## 1. Is a master's needed? (`after_undergrad`)

**Where it comes from.** Set for all 223 careers during the original data build, by Claude under the rules in
`Backend/data/DECISIONS.md` §8.7. Those rules are:

| Value | Meaning (DECISIONS §8.7) | Example |
|---|---|---|
| `masters_required` | you cannot practise or be recruited without it | Clinical Psychologist, Professor |
| `masters_is_the_entry` | the postgraduate degree is the usual door in | consulting via an MBA, public health via an MPH |
| `masters_advantage` | it meaningfully helps, but is not required | core engineering |
| `work_first` | industry values experience; a master's later, if ever | software, design |

**Owner's question, answered honestly:** until Round 12 no source was stored for this field — it was judgement.
Round 12 looked up the rule for every career where the data says a master's is required or is the way in:


| Career | Value | Status | What backs it | Sources |
|---|---|---|---|---|
| Physicist | required | Checked — official rule | Research and teaching posts need a master's — or a 4-year degree with 75% for a direct PhD (UGC 2022), which is what the data's 'skippable with a 4-year UG at 75%' says | [ugc_phd](https://www.ugc.gov.in/pdfnews/4405511_Draft-UGC-PhD-regulations-2022.pdf), [ugc_teach](https://indiankanoon.org/doc/25717311/) |
| Chemist | required | Checked — official rule | Research and teaching posts need a master's — or a 4-year degree with 75% for a direct PhD (UGC 2022), which is what the data's 'skippable with a 4-year UG at 75%' says | [ugc_phd](https://www.ugc.gov.in/pdfnews/4405511_Draft-UGC-PhD-regulations-2022.pdf), [ugc_teach](https://indiankanoon.org/doc/25717311/) |
| Biologist | required | Checked — official rule | Research and teaching posts need a master's — or a 4-year degree with 75% for a direct PhD (UGC 2022), which is what the data's 'skippable with a 4-year UG at 75%' says | [ugc_phd](https://www.ugc.gov.in/pdfnews/4405511_Draft-UGC-PhD-regulations-2022.pdf), [ugc_teach](https://indiankanoon.org/doc/25717311/) |
| Microbiologist | required | Published evidence | The research route (CSIR-NET, PhD) needs an M.Sc or a 4-year degree with 75%. That industry hires at M.Sc level is market practice, not a rule | [csir_net](https://competition.careers360.com/articles/csir-ugc-net-eligibility-criteria) |
| Biotechnologist | required | Published evidence | The research route (CSIR-NET, PhD) needs an M.Sc or a 4-year degree with 75%. That industry hires at M.Sc level is market practice, not a rule | [csir_net](https://competition.careers360.com/articles/csir-ugc-net-eligibility-criteria) |
| Bioinformatics Scientist | required | Published evidence | The research route (CSIR-NET, PhD) needs an M.Sc or a 4-year degree with 75%. That industry hires at M.Sc level is market practice, not a rule | [csir_net](https://competition.careers360.com/articles/csir-ugc-net-eligibility-criteria) |
| Geologist | required | Checked — official rule | The Geological Survey of India and CGWB recruit through UPSC's Combined Geo-Scientist exam, which needs a master's | [gsi](https://testbook.com/upsc-combined-geo-scientist/eligibility-criteria) |
| Atmospheric & Ocean Scientist | required | Checked — official rule | Research and teaching posts need a master's — or a 4-year degree with 75% for a direct PhD (UGC 2022), which is what the data's 'skippable with a 4-year UG at 75%' says | [ugc_phd](https://www.ugc.gov.in/pdfnews/4405511_Draft-UGC-PhD-regulations-2022.pdf), [ugc_teach](https://indiankanoon.org/doc/25717311/) |
| Astronomer & Space Scientist | required | Checked — official rule | Research and teaching posts need a master's — or a 4-year degree with 75% for a direct PhD (UGC 2022), which is what the data's 'skippable with a 4-year UG at 75%' says | [ugc_phd](https://www.ugc.gov.in/pdfnews/4405511_Draft-UGC-PhD-regulations-2022.pdf), [ugc_teach](https://indiankanoon.org/doc/25717311/) |
| Materials Scientist | required | Checked — official rule | Research and teaching posts need a master's — or a 4-year degree with 75% for a direct PhD (UGC 2022), which is what the data's 'skippable with a 4-year UG at 75%' says | [ugc_phd](https://www.ugc.gov.in/pdfnews/4405511_Draft-UGC-PhD-regulations-2022.pdf), [ugc_teach](https://indiankanoon.org/doc/25717311/) |
| Statistician | required | Checked — official rule | UPSC's Indian Statistical Service accepts a bachelor's with statistics, so a master's is not strictly required for the government route | [ies_iss](https://testbook.com/upsc-ies-iss/eligibility) |
| Research Psychologist | required | Checked — official rule | Research and teaching posts need a master's — or a 4-year degree with 75% for a direct PhD (UGC 2022), which is what the data's 'skippable with a 4-year UG at 75%' says | [ugc_phd](https://www.ugc.gov.in/pdfnews/4405511_Draft-UGC-PhD-regulations-2022.pdf), [ugc_teach](https://indiankanoon.org/doc/25717311/) |
| Forensic Scientist | required | Checked — official rule | State forensic labs recruit Scientific Officers at M.Sc level | [fsl](https://www.tgprb.in/FSL_PDF/FSL%20Notification.pdf) |
| Drug Discovery Scientist | required | Published evidence | The research route (CSIR-NET, PhD) needs an M.Sc or a 4-year degree with 75%. That industry hires at M.Sc level is market practice, not a rule | [csir_net](https://competition.careers360.com/articles/csir-ugc-net-eligibility-criteria) |
| Computer Science Researcher | required | Checked — official rule | Research and teaching posts need a master's — or a 4-year degree with 75% for a direct PhD (UGC 2022), which is what the data's 'skippable with a 4-year UG at 75%' says | [ugc_phd](https://www.ugc.gov.in/pdfnews/4405511_Draft-UGC-PhD-regulations-2022.pdf), [ugc_teach](https://indiankanoon.org/doc/25717311/) |
| Mathematician | required | Checked — official rule | Research and teaching posts need a master's — or a 4-year degree with 75% for a direct PhD (UGC 2022), which is what the data's 'skippable with a 4-year UG at 75%' says | [ugc_phd](https://www.ugc.gov.in/pdfnews/4405511_Draft-UGC-PhD-regulations-2022.pdf), [ugc_teach](https://indiankanoon.org/doc/25717311/) |
| Public Health Professional | is_the_entry | Published evidence | Public-health roles commonly hire at MPH level; this is hiring practice, not a legal rule | [mph](https://www.researchgate.net/publication/257364624_Career_Opportunities_for_Master_of_Public_Health_Graduates_in_India) |
| Economist | required | Checked — official rule | The Indian Economic Service needs a postgraduate degree in economics; academic posts need a master's plus NET | [ies_iss](https://testbook.com/upsc-ies-iss/eligibility), [ugc_teach](https://indiankanoon.org/doc/25717311/) |
| Public Policy Professional | required | Our judgement | No source found that makes a master's necessary; it is the common route (MPP / MA in public policy) | — |
| College & University Teacher | required | Checked — official rule | Assistant Professor: a master's with 55% plus NET/SET, or a PhD (UGC 2018) | [ugc_teach](https://indiankanoon.org/doc/25717311/) |
| Librarian & Information Professional | required | Checked — official rule | College and university librarians need a master's in library science with 55% plus NET | [library](https://www.mirandahouse.ac.in/file-nts-2022/essential%20qualifications.pdf) |
| Clinical Psychologist | required | Checked — official rule | Practising as a clinical psychologist needs RCI registration, which needs an RCI-recognised postgraduate clinical qualification | [rci](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12798336/) |
| Social Worker | is_the_entry | Published evidence | Government and hospital social-work posts commonly list an MSW; not a licensing rule | [msw](https://www.wcdcommpune.com/resources/pdf/DCPU_Positions_Eligibility_Criteria.pdf) |
| Child Protection & Family Welfare Officer | is_the_entry | Checked — official rule | District Child Protection Unit posts need a postgraduate degree in social work or a related field | [dcpu](https://www.wcdcommpune.com/resources/pdf/DCPU_Positions_Eligibility_Criteria.pdf) |
| Environmental Scientist | required | Checked — official rule | Pollution-control-board scientist posts need a first-class master's in environmental science | [cpcb](https://testbook.com/cpcb-scientist-b/eligibity-criteria) |
| Agricultural Scientist & Agronomist | required | Checked — official rule | ICAR's entry-level scientist posts need a master's in agronomy or a related discipline | [icar](https://icar.org.in/sites/default/files/Circulars/Minimum%20Educational%20Qualification%20for%20direct%20recruitment%20of%20entry%20level%20scientists%20through%20ARS%20Examination.pdf) |
| Archaeologist | required | Checked — official rule | The Archaeological Survey of India recruits Assistant Archaeologists at master's level | [asi](https://asi.nic.in/admin/whatsnew/download/299) |
| Anthropologist & Sociologist | required | Checked — official rule | The Anthropological Survey of India and university posts both need a master's in anthropology | [ansi](https://www.mysarkarinaukri.com/en/anthropological-survey-of-india/), [ugc_teach](https://indiankanoon.org/doc/25717311/) |
| Historian & Heritage Researcher | required | Checked — official rule | Academic and research posts need a master's with 55% plus NET or a PhD (UGC 2018) | [ugc_teach](https://indiankanoon.org/doc/25717311/) |
| Museum, Archive & Records Professional | required | Checked — official rule | Museum curator posts need a master's in museology, history of art, history or archaeology | [museum](https://www.mysarkarinaukri.com/find/national-museum-jobs/103385), [nmi](https://nmi.gov.in/studentsadmissionseligibilityma.htm) |
| Art Conservator & Restorer | required | Published evidence | The specialised training is a master's (e.g. MA Conservation, National Museum Institute); no recruitment rule was found | [nmi](https://nmi.gov.in/studentsadmissionseligibilityma.htm) |
| Classical Language & Manuscript Scholar | required | Checked — official rule | Academic and research posts need a master's with 55% plus NET or a PhD (UGC 2018) | [ugc_teach](https://indiankanoon.org/doc/25717311/) |

**Result:** 24 checked — official rule · 7 published evidence · 1 our judgement.

**One finding for the owner to decide — Statistician.** UPSC's Indian Statistical Service accepts a bachelor's with
statistics, so a master's is not strictly *required* for the government route. The data says `masters_required`.
The source suggests `masters_advantage`. Not changed — your call (change it with a data patch, or approve the study
bot's proposal when it makes one).

**`masters_advantage` (47 careers) — all still our judgement.** The study bot checks them over the coming
months, oldest first: Artificial Intelligence & Machine Learning Engineer, Embedded Software & IoT Developer, Chip Design Engineer, Aerospace Engineer, Metallurgical & Materials Engineer, Petroleum Engineer, Robotics & Automation Engineer, Biomedical Engineer, Nuclear Engineer, Urban & Regional Planner, Industrial & Product Designer, Clinical Research Associate, Doctor, Dentist, Ayurveda Doctor, Homeopathy Doctor, Veterinary Doctor, Pharmacist, Physiotherapist, Audiologist & Speech Therapist, Occupational Therapist, Dietitian & Clinical Nutritionist, Human Resources Professional, Operations & Administration Manager, Supply Chain & Logistics Manager, Product Manager, Management Consultant, Market Research Analyst, Financial Analyst, Lawyer, Sports Scientist & Performance Analyst, School Teacher, Special Educator, Counsellor & Psychotherapist, Development & Programme Professional, Monitoring, Evaluation & Impact Analyst, Rehabilitation & Disability Inclusion Professional, Environmental Engineer, GIS & Remote Sensing Analyst, Forest, Wildlife & Conservation Professional, Sustainability & ESG Professional, Renewable Energy Project Professional, Disaster Risk & Climate Resilience Professional, Agricultural Engineer, Food Technologist, Agricultural Extension & Agri-Business Professional, Heritage & Cultural Management Professional.

---

## 2. Is studying abroad needed? (`Backend/data/abroad.json`)

**The question it answers:** does a student in India *need* to study abroad for this career? It never says
which university — there is no university data, by design.

**The rule (written in the file):**
- `often_needed` — the main research or entry route regularly runs through study abroad;
- `helps` — a foreign degree is a common edge, but strong Indian routes exist (IIT M.Tech, IIMs, NID, IISc…);
- `not_needed` — everything else (198 careers).
- the **stage**: first degree, master's, PhD/research, or training.

**Owner's question, answered honestly:** this file was drafted by Claude in Round 11 from general knowledge of how
these careers are entered. Nothing was looked up online then. Round 12 looked up evidence where it was likely to
exist. Two rows changed because the evidence contradicted them: **Space Scientist** and **Computer Science
Researcher** were "often part of the route" and are now "helps" — India has strong PhD routes for both (JEST into
IISc, TIFR, IUCAA and RRI; the IITs and IISc). No career is "often needed" any more.

| Career | Need | Stage | Why | Status | Sources |
|---|---|---|---|---|---|
| Artificial Intelligence & Machine Learning Engineer | helps | masters | A master's abroad is a common way into AI research and product teams, though many are hired from Indian B.Tech and M.Tech too | Our judgement | — |
| Chip Design Engineer | helps | masters | A master's in VLSI abroad is a common route into design roles; IIT M.Tech programmes are the Indian equivalent | Our judgement | — |
| Aerospace Engineer | helps | masters | Design and research roles in aerospace often want a master's; some people take it abroad where the industry is larger | Our judgement | — |
| Robotics & Automation Engineer | helps | masters | A master's in robotics abroad is common for research and advanced R&D roles | Our judgement | — |
| Architect | helps | masters | A master's abroad helps for specialised practice (urban design, sustainable buildings) and international firms | Our judgement | — |
| Commercial Pilot | helps | training | Many trainee pilots do their flying hours at schools abroad; it costs more, and the licence must then be converted with DGCA | Published evidence | [dgca](https://www.wingmanlog.in/post/conversion-of-foreign-cpl-to-an-indian-pilot-license/) |
| Biomedical Engineer | helps | masters | Medical-device R&D often hires master's graduates; programmes abroad are a common choice | Our judgement | — |
| Urban & Regional Planner | helps | masters | A master's in planning abroad helps for international consultancies and multilateral projects | Our judgement | — |
| Industrial & Product Designer | helps | masters | A master's in design abroad helps for global product companies; NID and IIT design schools are strong in India | Our judgement | — |
| Physicist | helps | doctorate | A PhD or postdoc abroad is common for research careers, though IISc, TIFR and the IISERs train many physicists | Our judgement | — |
| Bioinformatics Scientist | helps | doctorate | Research roles often follow a PhD or postdoc abroad, where the large genomics groups are | Our judgement | — |
| Astronomer & Space Scientist | helps | doctorate | A PhD or postdoc abroad is common in astronomy research, though India's own routes (JEST into IISc, TIFR, IUCAA, RRI) are strong | Published evidence | [jest](https://en.wikipedia.org/wiki/Joint_Entrance_Screening_Test) |
| Research Psychologist | helps | doctorate | Research psychology in India is small; many researchers do their PhD abroad | Our judgement | — |
| Drug Discovery Scientist | helps | doctorate | Discovery research in big pharma often hires PhDs and postdocs trained abroad | Our judgement | — |
| Computer Science Researcher | helps | doctorate | Some research labs and faculty posts favour a PhD from abroad; IISc and the IITs are strong Indian routes | Our judgement | — |
| Mathematician | helps | doctorate | A PhD or postdoc abroad is common for research posts; CMI, ISI and TIFR are the strong Indian routes | Our judgement | — |
| Public Health Professional | helps | masters | An MPH from abroad helps for international health organisations; IIPH and AIIMS offer strong Indian MPHs | Our judgement | — |
| Product Manager | helps | masters | An MBA or master's abroad is one route into global product roles; most Indian PMs move in from engineering or an Indian MBA | Our judgement | — |
| Management Consultant | helps | masters | An MBA from a top global school opens international consulting offices; the IIMs are the main Indian route | Our judgement | — |
| Economist | helps | doctorate | Research economists at think tanks, the RBI and universities often hold a PhD from abroad | Our judgement | — |
| Public Policy Professional | helps | masters | A master's in public policy abroad (MPP/MPA) is a common route; Indian programmes at NLSIU, TISS and IIMs exist too | Our judgement | — |
| UI/UX Designer | helps | masters | A master's in HCI or interaction design abroad helps for global product teams; most UX hiring still runs on portfolios | Our judgement | — |
| Development & Programme Professional | helps | masters | A master's in development abroad helps for international NGOs and multilateral agencies | Our judgement | — |
| Sustainability & ESG Professional | helps | masters | A master's in sustainability abroad helps for global ESG and climate roles | Our judgement | — |
| Art Conservator & Restorer | helps | masters | Art conservation has few Indian programmes; many conservators train abroad, alongside the National Museum Institute in Delhi | Our judgement | — |

**How the report uses it:** the career card shows a "Studying abroad" line for these careers, with its label. If one
of a student's top ten careers is here, the report offers a connection with a study-abroad partner — nothing is shared
until the student ticks the consent box.

---

## 3. The other study information

- **Exam calendar** (`Backend/data/exam_calendar.json`) — 61 exams; what *usually* happens, never this year's exact dates.
  "Checked" rows were compared with published reporting of the official notice; "draft" rows show only the name and the
  official link. A fixture fails if a checked row is over 13 months old.
- **Where to study** (`Backend/data/study_places.json`) — NIRF ranks first (the main source); "Suggested — check" where no
  ranking covers the field. Public and private. The institution lists stay hidden until the owner has read them.
- **Programmes and cut-offs** (`Backend/data/cutoffs.json`, Round 12) — last year's closing rank for a programme, always
  with the year, round, category and the official results page; the student is told their own category's cut-off differs.
- **Master's options** in the report group a college or working student's top careers by the `after_undergrad` value above.
