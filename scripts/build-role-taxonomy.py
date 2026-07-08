#!/usr/bin/env python3
"""Deterministic keyword-rule taxonomy classifier v2.

Fixes v1:
- phrase() allows trailing suffixes ("control" matches "Controller")
- Many more family + archetype rules
- Depth: only frozen roles get deep_reviewed_reality_check (strict)
- Shortlist: top_candidate priority, ranked by rubric score
"""
import csv, json, re
from collections import Counter

FAMILIES = [
    "skilled_trades","construction_built_environment","digital_data_technology",
    "digital_data_technology","healthcare_clinical","care_social_support","education_training",
    "public_service_security","legal_finance_professional","creative_media_content",
    "engineering_manufacturing","science_research_environment","transport_aviation_logistics",
    "business_operations_commercial","hospitality_retail_personal_service",
    "hospitality_retail_personal_service","agriculture_land_animal","elite_competitive_long_route",
]
ARCHETYPES = [
    "apprenticeship_led","degree_led","regulated_registration_led","licence_led",
    "portfolio_led","experience_led","employer_training_led","self_employment_led",
    "commission_or_gig_led","selection_led","competitive_entry_led","feeder_pathway_led",
    "postgraduate_led","short_course_risk","mixed_route",
]

# Phrase matcher: leading word boundary, no trailing boundary so suffixes match.
# All inputs treated as literals (re.escape) — no regex metachars needed here.
def phrase(*ps):
    return re.compile(r"\b(?:" + "|".join(re.escape(p) for p in ps) + r")", re.I)

# --- Explicit overrides
OVERRIDES = {
    "electrician": dict(primaryFamily="skilled_trades", routeArchetype="apprenticeship_led",
        rubric=dict(regulated=True, expensiveWrongTurn=True, routeConfusion=2, demandLikely=2, highConsequenceAdvice=True),
        confidence="high", notes="Reviewed modular Reality Check. Frozen."),
    "plumber": dict(primaryFamily="skilled_trades", routeArchetype="apprenticeship_led",
        rubric=dict(regulated=True, expensiveWrongTurn=True, routeConfusion=2, demandLikely=2, highConsequenceAdvice=True),
        confidence="high", notes="Reviewed modular Reality Check. Frozen."),
    "hvac-engineer": dict(primaryFamily="skilled_trades", routeArchetype="apprenticeship_led",
        rubric=dict(regulated=True, expensiveWrongTurn=True, routeConfusion=2, demandLikely=2, highConsequenceAdvice=True),
        confidence="high", notes="Reviewed modular Reality Check. Gas Safe critical. Frozen."),
}

# --- Family rules: ordered. First match wins.
FAMILY_RULES = [
    # --- Supplemental precise rules (added after v2 QA of fall-throughs) ---
    (phrase("999 call handler","nhs 111","call handler (nhs","emergency medical technician","emergency medicine consultant","neurosurgeon","phlebotomist","play specialist","play therapist","play therapy","cognitive behavioural therapist","cbt therapist","clinical coder","clinical research associate","clinical trials manager","contact lens optician","doula","drug safety","pharmacovigilance","family therapist","healthcare assistant","healthcare manager","home health coordinator","mental health counselor","occupational health adviser","orthodontic therapist","personalized medicine","physical therapist","sterile services","telehealth","nhs ward manager","sports physiologist","sports therap","amhp","approved mental health","camhs"), "healthcare_clinical"),
    (phrase("after school","holiday club","baby sleep","care coordinator","care home manager","care manager","children's centre","children s centre","community development worker","crisis worker","cover supervisor","disability employment","elder care","family mediator","forest school","hospice","mental capacity","dols officer","nanny","parenting coach","play worker","portage worker","safeguarding manager","volunteer coordinator","welfare adviser","welfare rights","youth offending","home office immigration"), "care_social_support"),
    (phrase("armed forces officer","cabinet office","civil enforcement","civil service fast","close protection","communications officer (public","community safety","constituency caseworker","consular officer","corporate security","counter terrorism","cqc inspector","country of origin information","defence analyst","defence attach","digital intelligence","door supervisor","economist (government","education policy","energy policy","entry clearance","eod ","bomb disposal","explosive ordnance","health policy","hm treasury","human rights officer","immigration bail","immigration detention","immigration enforcement","intelligence analyst","licensing officer","lobbyist","government relations","loss prevention","maritime security","mine safety","mountain rescue","national crime agency","naval officer","oisc","osint","policy officer","political adviser","political advisor","political commentator","political party worker","polling analyst","postman","postal worker","press officer","private investigator","public health specialist","revenues and benefits","security guard","security manager","soldier","surveillance officer","tax inspector","hmrc","trading standards","water / environment","environment agency","weapons engineer","speechwriter","canine security"), "public_service_security"),
    (phrase("credit analyst","financial analyst","financial controller","financial crime","grant writer","trusts and grants","mortgage broker","paraplanner","patent attorney","property developer","tax advisor","tax adviser","tax technician","treasury analyst","fintech","fintech specialist"), "legal_finance_professional"),
    (phrase("ai content","audience engagement","blogger","brand content","brand storytelling","bsl interpreter","campaign content","captioner","subtitler","casting director","celebrity agent","talent agent","celebrity publicist","columnist","colorist","dit ","community manager","content moderator","content strategist","creative strategist","creator economy","creator partnerships","crisis communications","digital artist","digital experience","digital legacy","documentary producer","dramaturge","entertainment writer","esports content","esports athlete","event producer","exhibition manager","fashion model","feature writer","film researcher","illustration artist","infographic","interactive media","knitting","crochet designer","live stream","localization specialist","location manager","magician","entertainer","make-up artist","makeup artist","sfx make","model maker","prop maker","motivational speaker","multimedia designer","narrative designer","game writer","neuromarketing","newsletter writer","personal stylist","podcast host","podcast personality","podcast producer","post-production","print production","producer (tv","producer (film","production coordinator","production manager","keynote speaker","professional speaker","prompt designer","public intellectual","radio producer","rigger (live","scenic artist","sign language interpreter","sports pundit","sports writer","streaming content","stunt performer","television presenter","television producer","theatre director","theatre producer","trend forecaster","translator","travel writer","tv producer","ux writer","content designer","video producer","visual designer","xr designer","spatial computing","narrative","dj","charity fundraiser","antique dealer","antique restorer","picture framer","taxidermist","bookbinder","chocolatier","candle maker","luthier","instrument maker","leatherworker","woodworker","woodturner","tailor","bridal consultant","bridal stylist"), "creative_media_content"),
    (phrase("chief ai officer","caio","computer repair","identity & access","identity and access","online learning designer","learning experience designer","educational technologist","performance analyst","trust and safety","virtual assistant","healthcare ai","computer vision engineer","embedded systems","construction technology specialist","e-commerce manager","ecommerce manager","chief technology"), "digital_data_technology"),
    (phrase("consumer behaviour","clinical coder","polling analyst","climate risk modeller","impact and evaluation"), "digital_data_technology"),
    (phrase("advanced manufacturing","automation engineer","avionics","battery systems","cad technician","directional driller","drilling engineer","engineering technician","environmental engineer","explosives engineer","geotechnical engineer","land drainage","mechatronics","mineral processing","mining engineer","nanotechnology","power engineer","propulsion","quality systems engineer","satellite engineer","space systems","systems engineer","systems integration","telecommunications","traffic engineer","wind energy","manufacturing automation","underground miner","quarry manager","smart grid","electric vehicle","ev charging","heat pump installer","solar energy technician","solar panel installer","smart building technician","hgv / commercial vehicle mechanic","bicycle mechanic","cycle technician","mobile phone repair","diagnostic technician","electrical technician","damp proofing","dry liner","drylining","window fitter","maintenance technician","rail infrastructure"), "engineering_manufacturing"),
    (phrase("biologist","climatologist","ethicist","geoarchaeologist","hydrogeologist","land remediation","microbiologist","molecular biologist","neuroscientist","philosopher","postdoctoral","marine surveyor","timber surveyor","nature reserve","sports scientist"), "science_research_environment"),
    (phrase("beekeeper","apiarist","dog trainer","animal trainer","estate manager (rural","land agent","rural surveyor"), "agriculture_land_animal"),
    (phrase("commercial diver","saturation diver","cave diver","harbour master","logistics and transport","holiday / resort rep","holiday rep","resort rep"), "transport_aviation_logistics"),
    (phrase("catering manager","food and beverage","restaurant manager","revenue manager (hotel","spa manager","spa therapist","store assistant manager","venue manager","wilderness guide","expedition leader","mountain leader"), "hospitality_retail_personal_service"),
    (phrase("body piercer","brow technician","lash technician","microblading","pmu artist","spray tan","tattoo removal","wellness coach","domestic cleaner","cleaning business"), "hospitality_retail_personal_service"),
    (phrase("mountain rescue team","ski patrol","ski race coach","stunt performer","esports athlete","professional gamer","space tourism guide"), "elite_competitive_long_route"),
    # --- Original ordered rules below ---

    # Elite / competitive
    (phrase("astronaut","cosmonaut","test pilot","fighter pilot","olympian","professional footballer","professional athlete","premier league","formula 1","f1 driver","royal marines commando","special forces","sas / srr / sbs","special reconnaissance"), "elite_competitive_long_route"),

    # Public service / defence / emergency / clergy
    (phrase("police","detective","cid ","pcso","special constable","garda"), "public_service_security"),
    (phrase("firefighter","fire safety","fire investigator","fire officer","crowd safety"), "public_service_security"),
    (phrase("prison","probation","border force","immigration officer","coroner","bailiff","registrar (birth","registrar of birth"), "public_service_security"),
    (phrase("army","navy","raf","military","marines","commando","royal air force","royal navy","reservist","signals intelligence","intelligence corps","artillery","infantry","paratrooper","submariner","gchq","mi5","mi6","sigint","cyber operator","special reconnaissance"), "public_service_security"),
    (phrase("diplomat","civil servant","senior civil servant","government economist","government statistician","government social researcher","parliament","policy adviser","policy analyst","politician","councillor","local government","fiscal policy","monetary policy","public affairs","think tank"), "public_service_security"),
    (phrase("coastguard","lifeboat","rnli","search and rescue","lifeguard"), "public_service_security"),
    (phrase("priest","vicar","minister of religion","rabbi","imam","chaplain","monk","nun","religious","clergy"), "public_service_security"),

    # Healthcare clinical
    (phrase("paramedic","ambulance"), "healthcare_clinical"),
    (phrase("doctor","surgeon","physician","general practitioner","anaesthetist","psychiatrist","paediatrician","cardiologist","oncologist","radiologist","radiographer","pathologist","dermatologist","neurologist","urologist","gynaecologist","obstetrician","ophthalmologist","rheumatologist","endocrinologist","gastroenterologist","haematologist","geriatrician","immunologist","hepatologist","nephrologist","microbiologist \\(clinical\\)"), "healthcare_clinical"),
    (phrase("nurse","midwife","health visitor","district nurse","school nurse","practice nurse","nursing associate"), "healthcare_clinical"),
    (phrase("dentist","dental hygienist","dental therapist","dental nurse","dental technician","orthodontist"), "healthcare_clinical"),
    (phrase("pharmacist","pharmacy technician"), "healthcare_clinical"),
    (phrase("physiotherap","occupational therap","speech and language","dietitian","podiatr","osteopath","chiropract","optometr","dispensing optician","orthoptist","prosthetist","audiolog","perfusionist","operating department","sonographer","physician assistant","physician associate"), "healthcare_clinical"),
    (phrase("psychologist","psychotherapist","counsellor","cbt therapist","art therapist","music therapist","drama therapist"), "healthcare_clinical"),
    (phrase("veterinar","vet ","vet (",), "healthcare_clinical"),
    (phrase("clinical scientist","biomedical scientist","healthcare scientist","clinical technolog"), "healthcare_clinical"),

    # Beauty / wellness (must come after healthcare so "physiotherapy" wins over "therap")
    (phrase("acupunctur","homeopath","reflexolog","aromatherap","herbalist","nutritionist","hairdresser","barber","hair stylist","colourist","beautician","beauty therap","nail technician","manicurist","aesthetic practitioner","aesthetician","aesthetics","botox","dermal filler","laser therap","electrolysis","massage therap","masseur","personal trainer","fitness instructor","yoga","pilates","zumba","spin instructor","gym instructor","wellbeing","life coach","reiki","spiritual","holistic","hypnotherap","nlp practitioner","tarot","astrolog","salon owner"), "hospitality_retail_personal_service"),

    # Care / social support
    (phrase("social worker","social care","care worker","support worker","care assistant","home carer","carer","key worker","outreach worker","youth worker","refuge","hostel","housing officer","housing support","reablement","autism support","learning disability","recovery worker","substance misuse","domestic abuse","refugee","asylum","adoption","fostering","foster carer","adoption support","children's services","children services","adoption social","tenancy support","neighbourhood","leasehold officer","activities coordinator","reminiscence","dementia","end of life","palliative care worker","link worker","social prescribing","physiotherapy assistant","occupational therapy assistant","therapy assistant"), "care_social_support"),

    # Education / training
    (phrase("teacher","teaching assistant","early years","nursery","childminder","preschool","primary","secondary","sixth form","fe college","lecturer","professor","tutor","instructor","training officer","learning mentor","school counsellor","school pastoral","senco","pastoral","head teacher","deputy head","assistant head","school business","invigilator","exam ","functional skills","esol","adult education","adult learning","further education","higher education","special educational needs","sen teach","sen teaching","careers adviser","careers guidance","education welfare","education psycholog","learning support"), "education_training"),
    (phrase("librarian","archivist"), "education_training"),

    # Legal / finance / professional
    (phrase("solicitor","barrister","paralegal","legal executive","legal secretary","conveyancer","conveyancing","notary","costs lawyer","judge","magistrate","court clerk","legal cashier","lawyer","employment lawyer","legal adviser"), "legal_finance_professional"),
    (phrase("accountant","auditor","actuary","tax adviser","tax specialist","tax manager","bookkeeper","payroll","credit controller","insolvency","financial adviser","financial planner","wealth manager","mortgage adviser","insurance broker","underwriter","claims handler","claims adjuster","loss adjuster","compliance","risk analyst","risk manager","fraud analyst","aml","forensic accountant","chartered accountant","management accountant","internal audit","statutory audit"), "legal_finance_professional"),
    (phrase("investment banker","trader","stockbroker","hedge fund","private equity","quantitative analyst","portfolio manager","fund manager","asset manager","corporate finance","m&a","equity research","fixed income","derivatives","foreign exchange","commodities trader","relationship manager (corporate","banker","bank manager","branch manager (bank","banking","investment analyst","research analyst (finance"), "legal_finance_professional"),
    (phrase("regulatory affairs"), "legal_finance_professional"),

    # Data / AI / analytics
    (phrase("data scientist","data analyst","data engineer","analytics engineer","business intelligence","bi analyst","bi developer","insight analyst","statistician","biostatistician","econometrician","quantitative","data architect","data governance","data protection","analytics manager","research analyst (data","machine learning","mlops","ai research","ai engineer","ai safety","ai ethics","ai product","ai auditor","ai compliance","ai literacy","ai trainer","ai data","generative ai","prompt engineer","natural language processing","nlp engineer"), "digital_data_technology"),

    # Digital / product / technology (after data_ai so "data" wins)
    (phrase("software engineer","software developer","software architect","full stack","frontend","front-end","backend","back-end","web developer","mobile developer","ios developer","android developer","game developer","game programmer","game designer","game qa","embedded developer","firmware","devops","site reliability","platform engineer","cloud engineer","cloud architect","cloud security","solutions architect","systems architect","infrastructure engineer","network engineer","network administrator","systems administrator","database administrator"," dba","qa engineer","test engineer","software tester","automation tester","release engineer","build engineer"), "digital_data_technology"),
    (phrase("product manager","product owner","product designer","ux designer","ui designer","user experience","user researcher","ux researcher","service designer","interaction designer","design systems","scrum master","delivery manager","technical program"), "digital_data_technology"),
    (phrase("technical writer","developer relations","devrel","technical account"), "digital_data_technology"),
    (phrase("it support","helpdesk","service desk","desktop support","it technician","it manager","it director","cio","cto","information technology"), "digital_data_technology"),
    (phrase("cyber","cybersecurity","information security","infosec","penetration tester","pen tester","ethical hacker","soc analyst","security operations","security engineer","security architect","security consultant","incident response","threat intel","malware","digital forensic"), "digital_data_technology"),
    (phrase("blockchain","web3","smart contract","crypto","digital twin","augmented reality","virtual reality"," xr ","ar/vr","metaverse","robotics engineer","robotics technician","autonomous vehicle","semiconductor engineer","fpga"), "digital_data_technology"),
    (phrase("digital transformation","digital strategy","digital campaign","digital marketing","digital consultant","digital producer","digital editor","digital product"), "digital_data_technology"),

    # Creative / media / content
    (phrase("actor","actress","comedian","stand-up","voice actor","voice-over","voiceover","dancer","choreographer","musician","singer","songwriter","composer","conductor","music producer","record producer","sound engineer","audio engineer","audio editor","foley","adr","mixing engineer","mastering","opera","orchestra"), "creative_media_content"),
    (phrase("author","novelist","poet","playwright","screenwriter","scriptwriter","copywriter","content writer","journalist","reporter","editor","subeditor","sub-editor","publisher","publishing","literary agent","ghostwriter","proofreader","calligrapher"), "creative_media_content"),
    (phrase("photographer","videographer","cinematographer","director of photography","film director","film producer","film editor","tv producer","showrunner","broadcast","radio presenter","tv presenter","podcaster","youtube","content creator","influencer","social media","seo content","seo specialist","seo manager","ppc","paid media","performance marketing"), "creative_media_content"),
    (phrase("graphic designer","illustrator","animator","3d artist","vfx","visual effects","motion graphics","concept artist","storyboard","set designer","costume designer","stage designer","production designer","art director","creative director","brand designer","packaging designer","print designer","sound designer","wardrobe","props","stagehand","stage manager","lighting technician","lighting designer","lx ","av technician","event technician"), "creative_media_content"),
    (phrase("fine artist","sculptor","painter and printmaker","printmaker","ceramicist","glassblower","stained glass","muralist","street artist","tattooist","tattoo artist"), "creative_media_content"),
    (phrase("fashion designer","fashion buyer","fashion stylist","fashion pr","garment technolog","pattern cutter","seamstress","dressmaker","milliner","cobbler","shoemaker","jewell","goldsmith","silversmith","textile designer","textile artist","upholsterer"), "creative_media_content"),
    (phrase("curator","museum","gallery","heritage","conservation officer","conservator"), "creative_media_content"),

    # Skilled trades (must come before construction so "gas engineer" isn't grabbed)
    (phrase("carpenter","joiner","cabinet maker","cabinetmaker","furniture maker","bricklayer","stonemason","plasterer","tiler","painter and decorator","decorator","glazier","roofer","scaffolder","steeplejack","welder","fabricator","blacksmith","farrier","gas engineer","gas safe","boiler","refrigeration","air conditioning"," hvac","heating engineer","ventilation engineer","insulation installer","flooring installer","floor layer","fencing installer","fibre broadband","openreach","aerial installer","cctv installer","security systems installer","locksmith","auto electrician","industrial electrician","lighting technician / electrician","vehicle technician","car mechanic","motor mechanic","motorcycle mechanic","mot tester","panel beater","tyre fitter","hgv mechanic","plant mechanic","agricultural mechanic","marine mechanic","aircraft maintenance","dry lining","kitchen fitter","bathroom fitter","shopfitter","electrician"), "skilled_trades"),

    # Construction / built environment
    (phrase("architect","architectural technologist","architectural technician","landscape architect","interior designer","interior architect","building surveyor","quantity surveyor","land surveyor","geospatial","cartographer","town planner","urban planner","planning officer","building control","building inspector","clerk of works","site manager","site engineer","construction manager","project manager (construction","estimator","structural engineer","civil engineer","highways engineer","transport planner","demolition","groundworker","dumper","piling","reinforced concrete","formwork","facade","cladding","curtain walling","waterproofing","asbestos","cdm ","health and safety (construction"), "construction_built_environment"),
    (phrase("estate agent","letting agent","property manager","facilities manager","valuer","auctioneer","chartered surveyor","surveyor (property"), "construction_built_environment"),

    # Engineering / manufacturing
    (phrase("mechanical engineer","electrical engineer","electronics engineer","chemical engineer","aerospace engineer","aeronautical","marine engineer","naval architect","nuclear engineer","petroleum","offshore","subsea","pipeline","materials engineer","metallurgist","manufacturing engineer","production engineer","process engineer","industrial engineer","quality engineer","reliability engineer","maintenance engineer","instrumentation","control systems","plc engineer","cnc","tool maker","toolmaker","die maker","machinist","press operator","assembly worker","optical engineer","acoustic engineer","building services engineer","fire engineer","rail engineer","signalling","rolling stock","road safety engineer","reservoir engineer","water engineer","wastewater","renewable energy engineer","wind turbine","solar engineer","hydrogen","carbon capture","cultivated meat","fermentation engineer","bioprocess","biomedical engineer","semiconductor","precision agriculture","agricultural engineer","food engineer","packaging engineer"), "engineering_manufacturing"),

    # Science / research / environment
    (phrase("scientist","research assistant","research technician","research fellow","laboratory","lab technician","lab manager","biochemist","chemist","physicist","astronomer","astrophysicist","meteorologist","climate scientist","oceanographer","glaciolog","volcanolog","seismolog","geologist","geophysicist","geochemist","hydrolog","ecologist","zoologist","botanist","marine biolog","entomolog","ornitholog","conservation scientist","wildlife","ranger","warden","forester","arborist","rewilding","environmental scientist","environmental consultant","environmental health","toxicolog","epidemiolog","genomic","genetic","geneticist","bioinformatic","cell biolog","stem cell","pharmacolog","food scientist","food technolog","cosmetic scientist","cosmetic formulator","forensic scientist","forensic archaeolog","carbon accounting","sustainability","esg","speleolog","cave explorer","historian","genealog","archaeolog"), "science_research_environment"),

    # Transport / aviation / logistics
    (phrase("pilot","first officer","co-pilot","cabin crew","flight attendant","air traffic","airline captain","airport operations","ground handler","airport ground","ramp agent","aircraft dispatcher","airfield","airside","load controller","aviation safety","aviation security","drone operator","uav","glider","gliding"), "transport_aviation_logistics"),
    (phrase("train driver","tram driver","bus driver","coach driver","hgv driver","lgv driver","lorry driver","van driver","taxi driver","private hire","chauffeur","delivery driver","courier","dispatcher","logistics coordinator","logistics manager","supply chain","warehouse","forklift","freight forwarder","shipping","customs","port operative","stevedore","docker","harbourmaster","ferry","ship captain","master mariner","deckhand","engineer officer (marine","able seaman","fisherman","fishing","aquaculture","fish farmer"), "transport_aviation_logistics"),

    # Agriculture / land / animal
    (phrase("farmer","farm worker","farm manager","farmhand","stockperson","dairy","shepherd","livestock","poultry","gamekeeper","stalker","huntsman","kennel","cattery","dog groomer","dog walker","pet sitter","zookeeper","aquarist","animal care","animal welfare","animal behaviour","rspca","horticultur","gardener","grounds maintenance","landscaper","tree surgeon","florist","garden designer","viticultur","winemaker","brewer","distiller","cider","greenkeeper","greenskeeper","groundsman","pest control","exterminator","arable","crop","countryside","land manager","agricultural","agronom"), "agriculture_land_animal"),

    # Hospitality / retail / service
    (phrase("chef","cook","kitchen porter","commis","sous chef","head chef","pastry","baker","butcher","fishmonger","cheesemonger","greengrocer","barista","bartender","mixologist","sommelier","waiter","waitress","server","hotel manager","hotel receptionist","concierge","housekeeper","hospitality","event manager","event planner","event coordinator","wedding","festival","conference","banqueting","nightclub","tour guide","travel agent","travel consultant","cruise","holiday rep","attractions","theme park","amusement","gaming","casino","croupier","bingo","cinema","projectionist","usher","ticketing","recreation assistant","leisure"), "hospitality_retail_personal_service"),
    (phrase("shop assistant","retail assistant","sales assistant","cashier","checkout","stocker","visual merchandiser","personal shopper","mystery shopper","showroom sales","store manager","retail manager","retail supervisor","area manager (retail","shopkeeper"), "hospitality_retail_personal_service"),

    # Funeral / life-events
    (phrase("funeral director","funeral arranger","embalmer","celebrant"), "public_service_security"),

    # Sports & coaching → creative/media umbrella for now (portfolio + gig)
    (phrase("sports coach","sports development","strength and conditioning","sports scientist","sports psychologist","sports agent","sports journalist","sports referee","referee","umpire","match official","football coach","rugby coach","tennis coach","swimming coach","athletics coach","ski instructor","snowboard instructor","surf instructor","climbing instructor","diving instructor","scuba","skydive","paragliding","sailing instructor","riding instructor","equestrian","jockey","stable"), "elite_competitive_long_route"),

    # Business ops / commercial / sales (catch-all, must come near last)
    (phrase("sales representative","sales executive","sales manager","sales director","sales engineer","account manager","account executive","business development","key account","enterprise sales","inside sales","sdr","sales development","field sales","merchandiser (retail buyer","buyer","category manager","procurement","purchasing","supplier","vendor manager","contracts manager","commercial manager","commercial director","operations manager","operations director","chief operating","general manager","managing director","chief executive","charity chief","founder","entrepreneur","startup"), "business_operations_commercial"),
    (phrase("marketing manager","marketing executive","marketing director","brand manager","brand strategist","pr manager","public relations","communications manager","internal comms","corporate comms","crm manager","email marketing","marketing analyst","market researcher","customer success","customer experience","support manager","call centre","contact centre","customer service","receptionist","administrator","administrative assistant","office manager","executive assistant","personal assistant","secretary","data entry","records manager","project manager","programme manager","program manager","business analyst","change manager","transformation consultant","strategy consultant","management consultant","hr manager","human resources","hr business partner","recruiter","recruitment consultant","talent acquisition","people partner","learning and development","reward manager","compensation","payroll manager","employee relations","diversity","inclusion","organisational development","campaign manager","campaign strategist"), "business_operations_commercial"),
]

# --- Archetype rules
ARCH_RULES = [
    (phrase("astronaut","cosmonaut","test pilot","olympian","professional athlete","premier league","professional footballer","actor","actress","comedian","stand-up","voice actor","dancer","musician","singer","songwriter","conductor","opera","tv presenter","radio presenter","podcaster","youtube","content creator","influencer"," model "," dj"), "competitive_entry_led"),
    (phrase("sas","sbs","special forces","royal marines commando","special reconnaissance"), "competitive_entry_led"),

    (phrase("doctor","physician","surgeon","general practitioner","anaesthetist","psychiatrist","paediatrician","cardiologist","oncologist","radiologist","radiographer","pathologist","dermatologist","neurologist","urologist","gynaecologist","obstetrician","ophthalmologist","dentist","dental hygienist","dental therapist","orthodontist","nurse","midwife","paramedic","pharmacist","physiotherap","occupational therap","speech and language","dietitian","podiatr","osteopath","chiropract","optometr","dispensing optician","orthoptist","prosthetist","audiolog","operating department","sonographer","clinical psychologist","counselling psychologist","forensic psychologist","educational psychologist","art therapist","music therapist","drama therapist","psychotherap","social worker","veterinar"," vet ","vet (","architect","chartered surveyor","structural engineer","solicitor","barrister","conveyancer","actuary","chartered accountant","teacher","head teacher","senco","clinical scientist","biomedical scientist","perfusionist","physician assistant","physician associate","lawyer","judge","magistrate"), "regulated_registration_led"),

    (phrase("hgv driver","lgv driver","lorry driver","train driver","tram driver","bus driver","coach driver","taxi driver","private hire","chauffeur","pilot","first officer","co-pilot","cabin crew","air traffic","gas engineer","gas safe","offshore","scaffolder","asbestos","crane operator","forklift","door supervisor","sia licence","security guard","electrician","master mariner","ship captain","harbourmaster","commercial diver","saturation diver","drone operator","uav","aircraft maintenance"), "licence_led"),

    (phrase("graphic designer","illustrator","animator","3d artist","vfx","motion graphics","concept artist","photographer","videographer","fashion designer","interior designer","ux designer","ui designer","product designer","service designer","interaction designer","architectural technologist","game developer","game designer","web developer","fine artist","sculptor","tattooist","tattoo artist","copywriter","content writer","author","novelist","poet","playwright","screenwriter","scriptwriter","calligrapher"), "portfolio_led"),

    (phrase("actor","actress","comedian","voice actor","musician","singer","songwriter"," dj ","tv presenter","radio presenter","podcaster","youtube","content creator","influencer"," model ","freelance","gig ","session musician","voice-over","voiceover","stunt","choreographer"), "commission_or_gig_led"),

    (phrase("clinical psychologist","counselling psychologist","educational psychologist","forensic psychologist","clinical scientist","research scientist","phd ","postdoc","research fellow","lecturer","professor","astrophysicist","astronomer","molecular biolog","biochemist","geneticist","bioinformatic","quantitative analyst","epidemiolog","immunolog","biomedical scientist"), "postgraduate_led"),

    (phrase("police","detective","pcso","special constable","garda","firefighter","prison officer","probation","border force","civil servant","diplomat","gchq","mi5","mi6","army","navy","raf","military","marines","reservist","signals intelligence","intelligence corps","artillery","infantry","paratrooper","submariner","coastguard","rnli","lifeguard"), "selection_led"),

    (phrase("aesthetic practitioner","aesthetician","botox","dermal filler","laser therap","electrolysis","life coach","reiki","reflexolog","holistic","hypnotherap","nlp practitioner","crystal healer","tarot","astrolog","forex trainer"), "short_course_risk"),

    (phrase("gardener","florist","dog walker","dog groomer","pet sitter","childminder","cleaner","window cleaner","handyman","seamstress","dressmaker","milliner","tattooist","private tutor","personal trainer","yoga","pilates","freelance","salon owner","tradesman","self-employed"), "self_employment_led"),

    (phrase("engineer","scientist","analyst","economist","statistician","biologist","physicist","chemist","geologist","historian","curator","town planner","urban planner","transport planner","landscape architect","product manager","product owner","project manager","programme manager","business analyst","consultant","strategy","marketing manager","brand manager","hr manager","finance manager","accountant","auditor","tax ","banker","trader","investment","actuary","solicitor","barrister","paralegal","therapist","policy adviser","policy analyst"), "degree_led"),

    (phrase("carpenter","joiner","cabinet maker","cabinetmaker","bricklayer","stonemason","plasterer","tiler","painter and decorator","decorator","glazier","roofer","welder","fabricator","blacksmith","farrier","gas engineer","heating engineer","hvac","ventilation","refrigeration","insulation installer","flooring installer","fencing installer","fibre broadband","openreach","cctv installer","locksmith","vehicle technician","car mechanic","motor mechanic","motorcycle mechanic","panel beater","tyre fitter","hgv mechanic","plant mechanic","agricultural mechanic","aircraft maintenance","dry lining","kitchen fitter","bathroom fitter","shopfitter","chef","baker","butcher","hairdresser","barber","beauty therap","nail technician","dental technician","optical technician","laboratory technician","lab technician","pharmacy technician","engineering technician","maintenance technician","cnc","machinist","tool maker","toolmaker","electrician"), "apprenticeship_led"),

    (phrase("call centre","contact centre","customer service","sales assistant","retail assistant","shop assistant","cashier","warehouse","forklift","kitchen porter","waiter","waitress","bartender","housekeeper","cleaner","porter","security guard","receptionist","administrator","admin assistant","data entry","delivery driver","courier","van driver","recreation assistant","ticketing","showroom sales"), "employer_training_led"),

    (phrase("director","head of","chief","c-suite","founder","entrepreneur","managing director","general manager","operations manager","operations director","charity chief"), "experience_led"),

    (phrase("stunt","referee","umpire"," coach ","sports coach","football coach","rugby coach","tennis coach","swimming coach","athletics coach","ski instructor"), "feeder_pathway_led"),
]

# --- Rubric heuristics
REGULATED = phrase(
    "doctor","physician","surgeon","general practitioner","anaesthetist","psychiatrist","paediatrician",
    "cardiologist","oncologist","radiologist","radiographer","pathologist","dermatologist","neurologist",
    "gynaecologist","obstetrician","ophthalmologist","dentist","dental hygienist","dental therapist","dental nurse","orthodontist",
    "nurse","midwife","paramedic","pharmacist","physiotherap","occupational therap","speech and language",
    "dietitian","podiatr","osteopath","chiropract","optometr","dispensing optician","orthoptist",
    "prosthetist","audiolog","operating department","sonographer","clinical psychologist","counselling psychologist",
    "forensic psychologist","educational psychologist","art therapist","music therapist","drama therapist",
    "psychotherap","social worker","veterinar"," vet ","architect","chartered surveyor",
    "structural engineer","solicitor","barrister","conveyancer","actuary","chartered accountant","teacher","head teacher","senco",
    "gas engineer","gas safe","electrician","pilot","air traffic","train driver","hgv driver","lgv driver",
    "commercial diver","saturation diver","door supervisor","sia licence","aircraft maintenance","funeral director",
    "clinical scientist","biomedical scientist","perfusionist","police","firefighter","prison officer","probation officer",
    "border force","master mariner","ship captain","harbourmaster","embalmer","physician assistant","physician associate",
    "lawyer","judge","magistrate","radiographer","asbestos",
)

EXPENSIVE = phrase(
    "doctor","physician","surgeon","dentist","veterinar"," vet ","solicitor","barrister","architect",
    "clinical psychologist","pilot","airline","actor","actress","musician","opera","conductor",
    "aesthetic practitioner","aesthetician","botox","dermal filler","chiropract","osteopath",
    "personal trainer","life coach","aromatherap","reflexolog","holistic","forex","crypto",
    "influencer","content creator","fashion designer","interior designer",
    "gas engineer","electrician","plumber","heating engineer","hvac",
    "counsellor","psychotherap","hypnotherap","nlp practitioner",
    "psychotherapy","coaching qualification",
)

CONFUSING = phrase(
    "software engineer","software developer","web developer","full stack","frontend","backend","game developer",
    "data scientist","data analyst","product manager","product owner","ux designer","ui designer","product designer",
    "cyber","cybersecurity","ai engineer","ml engineer","machine learning","prompt engineer",
    "nurse","paramedic","doctor","physician","surgeon","dentist","teacher","police","firefighter",
    "solicitor","barrister","architect","actor","actress","musician","personal trainer",
    "aesthetic practitioner","botox","dermal filler","life coach","counsellor","psychotherap",
    "journalist","photographer","film director","film producer","screenwriter",
    "influencer","content creator","youtube","podcaster",
    "hgv driver","train driver","pilot","first officer","cabin crew","drone operator",
    "electrician","plumber","gas engineer","heating engineer","hvac","carpenter","joiner","welder",
    "chef","hairdresser","barber","beauty therap","dental nurse","dental technician",
    "veterinar","social worker","radiographer","physician associate","physician assistant",
    "estate agent","mortgage adviser","financial adviser","accountant","auditor",
    "psychologist","clinical psychologist",
    "actuary","quantity surveyor","structural engineer","civil engineer",
)

HIGH_CONSEQ = phrase(
    "doctor","physician","surgeon","general practitioner","anaesthetist","psychiatrist","paediatrician","radiologist","pathologist",
    "nurse","midwife","paramedic","pharmacist","dentist","veterinar",
    "clinical psychologist","psychotherap","counsellor","social worker",
    "solicitor","barrister","judge","magistrate","conveyancer","family law","employment lawyer",
    "police","firefighter","prison officer","probation officer","border force","coastguard","army","navy","raf","military",
    "gas engineer","gas safe","electrician","structural engineer","civil engineer","asbestos",
    "pilot","first officer","air traffic","train driver","hgv driver","master mariner","ship captain","drone operator",
    "aesthetic practitioner","botox","dermal filler","laser therap","embalmer","funeral director",
    "aircraft maintenance","commercial diver","saturation diver",
    "cyber","cybersecurity","information security","financial adviser","mortgage adviser","actuary",
    "teacher","head teacher","senco","early years","childminder","youth worker",
)

HIGH_DEMAND = phrase(
    "software engineer","software developer","web developer","full stack","frontend","backend","devops","cloud engineer",
    "data scientist","data analyst","data engineer","cyber","cybersecurity","ai engineer","ml engineer",
    "nurse","doctor","general practitioner","paramedic","radiographer","pharmacist","dentist","physiotherap","midwife",
    "teacher","teaching assistant","early years","senco",
    "electrician","plumber","gas engineer","heating engineer","hvac","carpenter","joiner","welder","bricklayer",
    "chef","hairdresser","barber","beauty therap",
    "hgv driver","lgv driver","van driver","warehouse","delivery driver",
    "care worker","support worker","social worker","social care","home carer",
    "accountant","auditor","project manager","product manager","business analyst",
    "police","firefighter","army","prison officer",
    "solicitor","paralegal","conveyancer",
    "estate agent","mortgage adviser","financial adviser","recruiter","recruitment consultant",
    "marketing manager","sales manager","account manager","account executive","sales representative","business development",
    "veterinar","architect","structural engineer","civil engineer",
    "content creator","social media","seo ","ppc","recruitment consultant",
)

MEDIUM_DEMAND = phrase(
    "engineer","analyst","technician","officer","manager","coordinator","assistant",
    "consultant","adviser","specialist","designer","developer","operator",
    "administrator","representative","planner","surveyor","controller","supervisor",
)

NEEDS_REVIEW = phrase(
    "product manager","ux researcher","user researcher","management consultant","strategy consultant",
    "ai ethics","ai safety","ai auditor","ai compliance","prompt engineer","prompt designer","ai literacy",
    "space tourism","digital twin","augmented reality","virtual reality","metaverse","web3","blockchain",
    "smart contract","autonomous vehicle","cultivated meat","carbon capture","quantum",
    "social prescribing","link worker","quantity surveyor",
    "generative ai","futurist","trend analyst","trend forecaster",
    "content creator","influencer","chief ai officer","caio","healthcare ai",
    "creator economy","personalized medicine","personal medicine",
    "digital legacy","circular economy","ethicist","applied ethicist",
    "esports athlete","professional gamer","xr designer","spatial computing","chief technology officer",
)

def first_match(rules, name):
    for rx, label in rules:
        if rx.search(name):
            return label
    return None

def score(r):
    return ((2 if r["regulated"] else 0) + (2 if r["expensiveWrongTurn"] else 0)
            + r["routeConfusion"] + r["demandLikely"] + (2 if r["highConsequenceAdvice"] else 0))

def priority_from_score(s):
    if s >= 8: return "top_candidate"
    if s >= 5: return "strong_candidate"
    if s >= 2: return "possible_later"
    return "not_priority"

DEFAULT_ARCH_BY_FAMILY = {
    "skilled_trades":"apprenticeship_led",
    "construction_built_environment":"degree_led",
    "digital_data_technology":"portfolio_led",
    "digital_data_technology":"degree_led",
    "healthcare_clinical":"regulated_registration_led",
    "care_social_support":"employer_training_led",
    "education_training":"regulated_registration_led",
    "public_service_security":"selection_led",
    "legal_finance_professional":"degree_led",
    "creative_media_content":"portfolio_led",
    "engineering_manufacturing":"degree_led",
    "science_research_environment":"degree_led",
    "transport_aviation_logistics":"licence_led",
    "business_operations_commercial":"experience_led",
    "hospitality_retail_personal_service":"employer_training_led",
    "hospitality_retail_personal_service":"apprenticeship_led",
    "agriculture_land_animal":"experience_led",
    "elite_competitive_long_route":"competitive_entry_led",
}

def classify(slug, name):
    if slug in OVERRIDES:
        o = OVERRIDES[slug]
        s = score(o["rubric"])
        return dict(
            roleSlug=slug, roleName=name,
            primaryFamily=o["primaryFamily"], routeArchetype=o["routeArchetype"],
            recommendedRealityCheckDepth="deep_reviewed_reality_check",
            deepCheckRubric=o["rubric"],
            deepCheckPriority=priority_from_score(s),
            confidence=o["confidence"],
            notes=o.get("notes"),
        )

    family = first_match(FAMILY_RULES, name)
    unmatched_family = family is None
    if unmatched_family:
        family = "business_operations_commercial"

    arch = first_match(ARCH_RULES, name) or DEFAULT_ARCH_BY_FAMILY[family]

    rubric = dict(
        regulated=bool(REGULATED.search(name)),
        expensiveWrongTurn=bool(EXPENSIVE.search(name)),
        routeConfusion=2 if CONFUSING.search(name) else (1 if MEDIUM_DEMAND.search(name) else 0),
        demandLikely=2 if HIGH_DEMAND.search(name) else (1 if MEDIUM_DEMAND.search(name) else 0),
        highConsequenceAdvice=bool(HIGH_CONSEQ.search(name)),
    )
    s = score(rubric)

    # Strict depth rule: only frozen (overrides) get deep; everyone else standard/light
    if s >= 5:
        depth = "light_route_checker"
    else:
        depth = "standard_role_page"

    confidence = "needs_review" if (unmatched_family or NEEDS_REVIEW.search(name)) else "high"

    entry = dict(
        roleSlug=slug, roleName=name,
        primaryFamily=family, routeArchetype=arch,
        recommendedRealityCheckDepth=depth,
        deepCheckRubric=rubric,
        deepCheckPriority=priority_from_score(s),
        confidence=confidence,
    )
    if unmatched_family:
        entry["notes"] = "Fell through family rules; assigned catch-all. Manual review needed."
    return entry

def main():
    rows = list(csv.DictReader(open("/tmp/roles.csv")))
    out = [classify(r["role_slug"], r["role_name"]) for r in rows]
    out.sort(key=lambda e: e["roleName"].lower())
    json.dump(out, open("/tmp/role-taxonomy.json","w"), indent=2, ensure_ascii=False)

    fam = Counter(e["primaryFamily"] for e in out)
    arch = Counter(e["routeArchetype"] for e in out)
    depth = Counter(e["recommendedRealityCheckDepth"] for e in out)
    prio = Counter(e["deepCheckPriority"] for e in out)
    conf = Counter(e["confidence"] for e in out)
    print(f"Total: {len(out)}")
    print("Families:")
    for k,v in fam.most_common(): print(f"  {v:4d}  {k}")
    print("Archetypes:")
    for k,v in arch.most_common(): print(f"  {v:4d}  {k}")
    print("Depth:", dict(depth))
    print("Priority:", dict(prio))
    print("Confidence:", dict(conf))

    frozen = set(OVERRIDES.keys())
    top = [e for e in out if e["deepCheckPriority"] == "top_candidate" and e["roleSlug"] not in frozen]
    ranked = sorted(top, key=lambda e: (score(e["deepCheckRubric"]),
        e["deepCheckRubric"]["demandLikely"], e["deepCheckRubric"]["routeConfusion"]), reverse=True)
    shortlist = ranked[:25]
    print(f"\nShortlist ({len(shortlist)} of {len(top)} top_candidates):")
    for e in shortlist:
        print(f"  {score(e['deepCheckRubric'])}  {e['roleName']}  [{e['primaryFamily']} / {e['routeArchetype']}]")

    print(f"\nNeeds review: {conf.get('needs_review', 0)}")
    # Roles that fell through family rules
    fallthrough = [e for e in out if e.get("notes","").startswith("Fell through")]
    print(f"Fell through family rules: {len(fallthrough)}")
    for e in fallthrough[:20]:
        print(f"  {e['roleName']}")

main()
