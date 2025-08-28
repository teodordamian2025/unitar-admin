// ==================================================================
// CALEA: scripts/setup-contract-templates.js
// DATA: 28.08.2025 16:30 (ora României)
// DESCRIERE: Script pentru crearea sistemului de template-uri contracte
// ==================================================================

const fs = require('fs');
const path = require('path');

// Directoarele necesare
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const CONTRACTE_DIR = path.join(UPLOADS_DIR, 'contracte');
const TEMPLATES_DIR = path.join(CONTRACTE_DIR, 'templates');

// Template-ul default cu placeholder-uri
const DEFAULT_TEMPLATE = `**CONTRACT DE SERVICII**

**NR. {{contract.numar}} din {{contract.data}}**

**CAP.I. PĂRȚI CONTRACTANTE**

1. Între {{client.nume}}, persoană juridică română, cu sediul în {{client.adresa}}, înmatriculată la Oficiul Registrului Comerțului sub nr. {{client.nr_reg_com}}, C.U.I. {{client.cui}}, reprezentată prin {{client.reprezentant}} denumită în continuare **BENEFICIAR**

Și

2. **S.C. UNITAR PROIECT TDA S.R.L.** cu sediul social în {{firma.adresa}}, având CIF {{firma.cui}} și nr. de înregistrare la Registrul Comerțului {{firma.nr_reg_com}}, având contul IBAN: {{firma.cont_ing}}, deschis la banca ING, și cont Trezorerie IBAN: {{firma.cont_trezorerie}}, e-mail: {{firma.email}}, reprezentată legal de Damian Teodor, în calitate de Administrator, numită în continuare **PRESTATOR**.

**CAP. II. OBIECTUL CONTRACTULUI**

Obiectul contractului îl reprezintă:

Realizare {{proiect.denumire}}

{{#proiect.descriere}}
Descriere detaliată: {{proiect.descriere}}
{{/proiect.descriere}}

{{#proiect.adresa}}
Adresa execuție: {{proiect.adresa}}
{{/proiect.adresa}}

{{#subproiecte}}
**Componente proiect:**
{{#subproiecte.lista}}
- {{denumire}}: {{valoare}} {{moneda}}
{{/subproiecte.lista}}
{{/subproiecte}}

{{#articole_suplimentare}}
**Servicii suplimentare:**
{{#articole_suplimentare.lista}}
- {{descriere}}: {{valoare}} {{moneda}}
{{/articole_suplimentare.lista}}
{{/articole_suplimentare}}

**CAP.III. DURATA CONTRACTULUI:**

1. Contractul se încheie pe o perioadă determinată, cu următoarele termene:
- Data început: {{proiect.data_start}}
- Data finalizare: {{proiect.data_final}}
- Durata estimată: {{proiect.durata_zile}} zile

**CAP. IV. PREȚUL DE EXECUTARE AL LUCRĂRII**

1. Prețul pe care Beneficiarul îl datorează prestatorului pentru serviciile sale este de **{{proiect.valoare}} {{proiect.moneda}}** la care se aplică suplimentar TVA, plătiți în lei la cursul BNR din ziua facturării.

**Valoarea totală contract: {{suma_totala_ron}} RON + TVA**

Plățile vor fi realizate în modul următor:

{{#termene_personalizate}}
{{#termene_personalizate.lista}}
**Etapa {{index}}**: {{procent_plata}}% ({{valoare_etapa}} RON) - {{denumire}} (termen: {{termen_zile}} zile)
{{/termene_personalizate.lista}}
{{/termene_personalizate}}

2. Nerespectarea de către Beneficiar a termenelor de plată stabilite potrivit contractului și anexelor acestuia, poate atrage obligarea acestuia la plata de penalități de întârziere, în cuantum de 0.1% din contravaloarea proiectului pentru fiecare zi de întârziere, cuantumul penalităților putând depăși valoarea sumelor asupra cărora sunt calculate.

3. Nerespectarea de către Prestator a termenelor de predare a documentațiilor stabilite potrivit contractului și anexelor acestuia, poate atrage obligarea acestuia la plata de penalități de întârziere în cuantum de 0.1% din contravaloarea proiectului, pentru fiecare zi de întârziere, cuantumul penalităților putând depăși valoarea sumelor asupra cărora sunt calculate.

**CAP.V. OBLIGAȚIILE PĂRȚILOR**

I. Obligațiile prestatorului:

A). Va executa întocmai și la termen lucrările solicitate de către Beneficiar.

B). Va păstra confidențialitatea datelor.

C). Va executa lucrările la care s-a angajat prin semnarea prezentului contract cu maxima responsabilitate;

D). Va realiza modificările necesare, în cazul în care i se solicită acest lucru.

{{#proiect.responsabil}}
E). Responsabilul proiect din partea PRESTATOR: {{proiect.responsabil}}
{{/proiect.responsabil}}

II. Obligațiile Beneficiarului:

A). Va pune la dispoziția prestatorului datele de temă necesare și alte informații necesare pentru realizarea proiectului;

B). Va respecta termenele de plată stabilite prin prezentul contract;

{{#client.telefon}}
C). Persoană de contact: {{client.nume}} (Tel: {{client.telefon}}, Email: {{client.email}})
{{/client.telefon}}

**CAP. VI. ÎNCETAREA CONTRACTULUI**

1. Prezentul contract încetează de plin drept, fără a mai fi necesară intervenția unei instanțe judecătorești sau tribunal arbitrar, în cazul în care una dintre părți:

- nu își execută una dintre obligațiile esențiale enumerate la cap. V din prezentul contract;

- este declarată în stare de incapacitate de plăți sau a fost declanșată procedura de lichidare înainte de începerea executării prezentului contract;

- își încalcă oricare dintre obligațiile sale, după ce a fost avertizată, printr-o notificare scrisă, de către cealaltă parte, că o nouă nerespectare a acestora va duce la rezoluțiunea prezentului contract;

- la inițiativa oricărei părți, în termen de 30 zile de la data primirii notificării prin care i s-a adus la cunoștința celeilalte părți, intenția de încetare a contractului;

2. Partea care invocă o cauză de încetare a prevederilor prezentului o va notifica celeilalte părți, cu cel puțin 30 zile înainte de data la care încetarea urmează să-și producă efectele.

3. Rezoluțiunea prezentului contract nu va avea nici un efect asupra obligațiilor deja scădente între părțile contractante.

4. La încetarea contractului, indiferent de termenul de încetare, Beneficiarul va achita Prestatorului toate lucrările efectuate de acesta până la data încetării.

**CAP.VII. FORȚA MAJORĂ**

1. Nici una dintre părțile contractante nu răspunde de neexecutarea la termen sau/și de executarea în mod necorespunzător - total sau parțial - a oricărei obligații care îi revine în baza prezentului contract, dacă neexecutarea sau executarea necorespunzătoare a obligației respective a fost cauzată de forță majoră, așa cum este definită de lege.

2. Partea care invocă forță majoră este obligată să notifice celeilalte părți, în termen de 15 zile, producerea evenimentului și să ia toate măsurile posibile în vederea limitării consecințelor lui.

3. Dacă în termen de 15 zile de la producere, evenimentul respectiv nu încetează, părțile au dreptul să-și notifice încetarea de plin drept a prezentului contract fără ca vreuna dintre ele să pretindă daune.

**CAP. VIII. NOTIFICĂRILE ÎNTRE PĂRȚI**

1. În accepțiunea părților contractante, orice notificare adresată de una dintre acestea celeilalte este valabil îndeplinită dacă va fi transmisă prin e-mail.

2. În cazul în care notificarea se face pe cale poștală, ea va fi transmisă, prin scrisoare recomandată, cu confirmare de primire și se consideră primită de destinatar la data menționată de oficiul poștal primitor pe această confirmare.

3. Dacă notificarea se trimite prin fax sau e-mail, ea se consideră primită în prima zi lucrătoare după cea în care a fost expediată.

4. Notificările verbale nu se iau în considerare de nici una dintre părți, dacă nu sunt confirmate, prin intermediul uneia din modalitățile prevăzute la alineatele precedente.

**CAP. IX. LITIGII**

1. Părțile au convenit că toate neînțelegerile privind validitatea prezentului contract sau rezultate din interpretarea, executarea ori încetarea acestuia să fie rezolvate pe cale amiabilă de reprezentanții lor.

2. Dacă nu este posibilă rezolvarea litigiilor pe cale amiabilă, părțile se vor adresa instanțelor judecătorești competente.

**CAP.X. CLAUZE FINALE**

1. Modificarea prezentului contract se face numai prin act adițional încheiat între părțile contractante.

2. Prezentul contract reprezintă voința părților și înlătură orice altă înțelegere verbală dintre acestea, anterioară sau ulterioară încheierii lui.

3. În cazul în care părțile își încalcă obligațiile lor, neexercitarea de partea care suferă vreun prejudiciu a dreptului de a cere executarea întocmai sau prin echivalent bănesc a obligației respective nu înseamnă că ea a renunțat la acest drept al său.

4. Prezentul contract a fost încheiat, în 2 exemplare, câte unul pentru fiecare parte.

{{#observatii}}

**OBSERVAȚII SUPLIMENTARE:**

{{observatii}}
{{/observatii}}

---

**SEMNAT ÎN DATA: {{contract.data}}**

| BENEFICIAR | PRESTATOR |
|------------|-----------|
| **{{client.nume}}** | **S.C. UNITAR PROIECT TDA S.R.L.** |
| {{client.reprezentant}} | **DAMIAN TEODOR** |
| ................................. | ................................. |
`;

function createDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`📁 Director creat: ${dirPath}`);
  } else {
    console.log(`📁 Director există deja: ${dirPath}`);
  }
}

function createTemplate(filePath, content) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`📄 Template creat: ${filePath}`);
  } else {
    console.log(`📄 Template există deja: ${filePath}`);
  }
}

function setupContractTemplates() {
  console.log('🚀 Configurare sistem template-uri contracte...');
  
  try {
    // Creează directoarele
    createDirectory(UPLOADS_DIR);
    createDirectory(CONTRACTE_DIR);
    createDirectory(TEMPLATES_DIR);
    
    // Creează template-ul default
    const defaultTemplatePath = path.join(TEMPLATES_DIR, 'contract-default-template.txt');
    createTemplate(defaultTemplatePath, DEFAULT_TEMPLATE);
    
    // Creează template-urile pentru alte tipuri de documente
    const pvTemplatePath = path.join(TEMPLATES_DIR, 'pv-default-template.txt');
    const pvTemplate = DEFAULT_TEMPLATE.replace('CONTRACT DE SERVICII', 'PROCES VERBAL DE PREDARE');
    createTemplate(pvTemplatePath, pvTemplate);
    
    const anexaTemplatePath = path.join(TEMPLATES_DIR, 'anexa-default-template.txt');
    const anexaTemplate = DEFAULT_TEMPLATE.replace('CONTRACT DE SERVICII', 'ANEXĂ LA CONTRACT');
    createTemplate(anexaTemplatePath, anexaTemplate);
    
    // Creează .gitignore pentru templates (exclude uploads dar păstrează structura)
    const gitignorePath = path.join(CONTRACTE_DIR, '.gitignore');
    if (!fs.existsSync(gitignorePath)) {
      fs.writeFileSync(gitignorePath, `# Exclude all files
*
# But include directories and templates
!*/
!templates/*.txt
!.gitignore
`, 'utf8');
      console.log(`📋 .gitignore creat: ${gitignorePath}`);
    }
    
    console.log('✅ Sistem template-uri contracte configurat cu succes!');
    console.log(`📂 Directoare create:`);
    console.log(`   - ${UPLOADS_DIR}`);
    console.log(`   - ${CONTRACTE_DIR}`);
    console.log(`   - ${TEMPLATES_DIR}`);
    console.log(`📄 Template-uri create:`);
    console.log(`   - contract-default-template.txt`);
    console.log(`   - pv-default-template.txt`);
    console.log(`   - anexa-default-template.txt`);
    
  } catch (error) {
    console.error('❌ Eroare la configurarea sistemului de template-uri:', error);
    process.exit(1);
  }
}

// Rulează setup-ul
if (require.main === module) {
  setupContractTemplates();
}

module.exports = { setupContractTemplates };
