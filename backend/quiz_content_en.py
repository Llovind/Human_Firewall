"""English version of the seeded quiz.

Same option order as the Indonesian questions, so the correct answer index is shared. Keyed by the first 80 characters of the Indonesian question."""

QUIZ_EN = {
 "Anda menerima email dari HRD meminta Anda segera memverifikasi nomor rekening ba": {
  "question": "You receive an email from HR asking you to verify your bank account number through the attached link because of an annual bonus. What is the safest action?",
  "options": [
   "Click the link right away, because an annual bonus matters",
   "Contact HR directly on the official office phone number to verify",
   "Reply to the email and ask whether it is real",
   "Forward the email to other coworkers"
  ],
  "explanation": "Email that asks for financial details through a link is almost always a scam, however good it sounds. Contact HR on a number you already know, not one from the email."
 },
 "Apa tanda utama email phishing yang memanfaatkan urgensi emosional (Urgency)?": {
  "question": "What is the main sign of a phishing email that uses emotional urgency?",
  "options": [
   "It uses a casual, friendly tone",
   "It pushes you to act fast (for example: 'Your account will be closed in 24 hours')",
   "It includes the sender's full signature",
   "It is sent during official working hours"
  ],
  "explanation": "Scammers want you to act before you think. A tight deadline is the most common sign of phishing."
 },
 "Jika Anda menerima email mencurigakan dari alamat internal yang meminta verifika": {
  "question": "You receive a suspicious email from an internal address asking you to verify your mailbox quota. What is the safest thing to do?",
  "options": [
   "Check whether the link contains your old password",
   "Ignore it, because a full mailbox is not possible",
   "Click the link and enter a random password",
   "Forward it to the Security Telegram Bot to be checked"
  ],
  "explanation": "Do not reply or click anything. Forward it to the official security channel so the team can check it without putting you at risk."
 },
 "Apa yang dimaksud dengan 'Spear Phishing'?": {
  "question": "What is 'Spear Phishing'?",
  "options": [
   "A random mass phishing attack sent by robot email",
   "A targeted phishing attack designed for a specific victim or company",
   "A phishing attack by SMS or voice call",
   "Placing phishing banners on an official website"
  ],
  "explanation": "Spear phishing is made for one person or company. It often uses real names or projects, so it looks very convincing."
 },
 "Anda menerima email simulasi phishing. Anda mendeteksi bahwa tautannya palsu. Ap": {
  "question": "You receive a phishing simulation email and you notice the link is fake. What is the best step?",
  "options": [
   "Click the link to confirm it is fake",
   "Report the link through the Security Awareness Telegram Bot",
   "Leave it in your inbox",
   "Delete the email without reporting"
  ],
  "explanation": "Reporting a fake link helps the security team protect your colleagues. Do not click it and do not forward it."
 },
 "Mengapa taktik 'Teachable Moment' penting setelah karyawan tidak sengaja mengkli": {
  "question": "Why is the 'Teachable Moment' approach important after an employee accidentally clicks a phishing simulation link?",
  "options": [
   "To give the employee a disciplinary penalty",
   "To give education right away, while awareness of the mistake is high",
   "To expose the mistake to other departments",
   "To lock the employee's laptop for a while"
  ],
  "explanation": "People learn best right after they realise their mistake. That is why the lesson comes straight after the click, not weeks later."
 },
 "Anda menerima email yang mengaku dari rekan setim Anda, namun alamat email pengi": {
  "question": "You receive an email claiming to be from a teammate, but the sender's address is budi.santoso@netops-dumy.local (one letter 'm' is missing). Which tactic is being used?",
  "options": [
   "Domain Spoofing",
   "Typosquatting",
   "Credential Harvesting",
   "Ransomware"
  ],
  "explanation": "An address that looks right but has one letter wrong (typosquatting) is a common trick. Always read the full email address, not only the sender's name."
 },
 "Apa risiko terbesar dari mengklik gambar di dalam email spam dari pengirim tidak": {
  "question": "What is the biggest risk of clicking an image in a spam email from an unknown sender?",
  "options": [
   "It reduces your laptop's internet quota",
   "It can trigger an automatic malware download in the background (drive-by download)",
   "It changes your monitor resolution",
   "It sends spam email to all your contacts"
  ],
  "explanation": "An image in a spam email can carry code that downloads malware without you noticing (a drive-by download). Do not open images from unknown senders."
 },
 "Jika Anda tidak sengaja memasukkan password akun kantor ke form login dari link ": {
  "question": "If you accidentally enter your office account password on a login form from a suspicious email link, what must you do first?",
  "options": [
   "Wait for the simulation email to expire",
   "Change your office account password immediately and tell the SOC team",
   "Clear your browser history",
   "Shut down your laptop and go home"
  ],
  "explanation": "Change your password right away and tell the SOC so the attacker's access can be closed and other accounts checked. The faster, the smaller the damage."
 },
 "Teknik manipulasi psikologis apa yang biasa digunakan penyerang agar korban tida": {
  "question": "Which psychological manipulation technique do attackers commonly use so victims stop thinking critically when they receive a phishing email?",
  "options": [
   "Creating urgency, panic, false authority or the promise of a prize",
   "Providing a technical manual about file encryption",
   "Contacting the victim only on national holidays",
   "Using a high-level programming language"
  ],
  "explanation": "Attackers make you panic or feel tempted so you will not think critically. If a message makes you rush, stop and check first."
 },
 "Seseorang menelepon Anda mengaku dari tim IT Dukungan Pusat dan meminta Anda mem": {
  "question": "Someone calls you claiming to be from Central IT Support and asks you to read out the OTP code that just arrived on your phone. What do you do?",
  "options": [
   "Give it, because they say they are from Central IT",
   "Refuse and say that official IT never asks for an OTP",
   "Give a wrong OTP number to test them",
   "Tell them to call your manager"
  ],
  "explanation": "Real IT teams never ask for an OTP. That code is only for you; anyone who asks for it is trying to get into your account."
 },
 "Taktik 'Baiting' dalam rekayasa sosial sering kali melibatkan:": {
  "question": "The 'Baiting' tactic in social engineering often involves:",
  "options": [
   "Leaving a malware-infected USB drive in the office car park hoping someone plugs it in",
   "Sending a legitimate cooperation offer email",
   "Building a fake copy of an official bank site",
   "Sending an annual customer satisfaction survey"
  ],
  "explanation": "Baiting plays on curiosity, for example a flash drive that was 'left behind'. Never plug in an unknown device; hand it to the security team."
 },
 "Apa yang dimaksud dengan rekayasa sosial (Social Engineering)?": {
  "question": "What is social engineering?",
  "options": [
   "Software engineering to build a new social media platform",
   "Psychological manipulation so victims reveal confidential information",
   "Arranging cables in a data centre server room",
   "Writing an organisation's code of conduct"
  ],
  "explanation": "Social engineering attacks people, not systems: the attacker persuades someone to hand over information or access themselves."
 },
 "Seseorang tak dikenal mengikuti Anda di belakang melewati pintu masuk kantor tan": {
  "question": "A stranger follows you through the office entrance without tapping an access card (tailgating). What should you do?",
  "options": [
   "Let it go, because their card may have been left behind",
   "Ask them to tap their access card on the scanner, or report to security",
   "Smile and greet them warmly",
   "Offer to help carry their things"
  ],
  "explanation": "Tailgating relies on politeness. Ask the person to tap their own card or tell security; that is not rude."
 },
 "Penyerang rekayasa sosial sering kali berpura-pura menjadi figur otoritas (seper": {
  "question": "Social engineering attackers often pretend to be an authority figure (such as a Director or Auditor). Why is this tactic effective?",
  "options": [
   "Authority figures always have access to the servers",
   "The attacker has a photo of the Director's ID card",
   "Directors often send simulation emails",
   "Victims tend to obey and are reluctant to question an authority's orders"
  ],
  "explanation": "People tend to obey managers and officials. Attackers use that so you will not ask questions. An urgent order still needs checking through an official channel."
 },
 "Metode 'Pretexting' dalam social engineering melibatkan:": {
  "question": "The 'Pretexting' method in social engineering involves:",
  "options": [
   "Building a convincing false scenario so the victim believes it (for example: confirming an external audit)",
   "Sending a malicious PDF file through a chat bot",
   "Stealing passwords from a leaked database",
   "Backing up the office servers"
  ],
  "explanation": "Pretexting uses a believable story, such as an audit or a vendor visit, so the victim hands over information."
 },
 "Apa arti 'Vishing' dalam variasi rekayasa sosial?": {
  "question": "What does 'Vishing' mean among social engineering variations?",
  "options": [
   "Phishing carried out through a voice phone call (voice phishing)",
   "Phishing through QR codes (QR phishing)",
   "Phishing through SMS text messages",
   "Impersonating a social media profile"
  ],
  "explanation": "Vishing is phishing by phone. The caller can sound professional; if they ask for sensitive data, hang up and call back on an official number."
 },
 "Karakteristik password yang kuat menurut standar keamanan modern adalah:": {
  "question": "According to modern security standards, a strong password is:",
  "options": [
   "At least 12 characters long with upper and lower case letters, numbers and symbols",
   "An easy-to-remember word such as 'Infranexia2026'",
   "A short password changed every week",
   "A combination of your birth date and first name"
  ],
  "explanation": "Long, varied passwords are far harder to guess. At least 12 characters with upper case, lower case, numbers and symbols is a safe standard."
 },
 "Mengapa penggunaan Multi-Factor Authentication (MFA) sangat direkomendasikan?": {
  "question": "Why is Multi-Factor Authentication (MFA) strongly recommended?",
  "options": [
   "So your password never needs to be changed",
   "It adds an extra layer of security if your main password leaks",
   "It makes signing in to the portal faster",
   "It reduces memory use on the login server"
  ],
  "explanation": "MFA adds one more check, so a leaked password alone is not enough for an attacker to get in."
 },
 "Apa bahaya menggunakan password yang sama untuk akun personal (seperti e-commerc": {
  "question": "What is the danger of using the same password for a personal account (such as e-commerce) and your office account?",
  "options": [
   "Your e-commerce account will be linked to your office email",
   "If the personal account leaks online, attackers can use it to break into the office network",
   "It can cause your office account to be suspended automatically",
   "The office server will detect suspicious activity"
  ],
  "explanation": "The same password everywhere means one leak opens everything, including your office account. Use a different password for each account."
 },
 "Apa itu 'Credential Stuffing'?": {
  "question": "What is 'Credential Stuffing'?",
  "options": [
   "Entering login details at random on a fake form",
   "Automatically trying massively leaked passwords on many different websites",
   "Creating very long passwords with a generator",
   "Encrypting passwords with the SHA-256 algorithm"
  ],
  "explanation": "Credential stuffing tries leaked email and password pairs on many sites at once. A unique password for each account makes it fail."
 },
 "Kapan waktu terbaik untuk mengganti password akun kantor Anda?": {
  "question": "When is the best time to change your office account password?",
  "options": [
   "Only when you are notified that your password has expired",
   "When you suspect a data leak or after mistakenly clicking a phishing simulation",
   "Every day before you start work",
   "Only when a coworker tells you to"
  ],
  "explanation": "Change your password straight away if there is a sign of a leak or you clicked by mistake. Waiting only gives an attacker more time."
 },
 "Bagaimana cara aman untuk menyimpan password yang banyak dan kompleks?": {
  "question": "What is a safe way to store many complex passwords?",
  "options": [
   "Writing them on sticky notes under the keyboard or monitor",
   "Using an official, encrypted company password manager",
   "Saving them in an Excel file on the Desktop with no password",
   "Sending them to your personal Telegram chat"
  ],
  "explanation": "A company password manager stores many complex passwords in encrypted form, so you do not have to remember or write them down."
 },
 "Apa fungsi utama dari pengamanan 'OTP' (One-Time Password)?": {
  "question": "What is the main purpose of 'OTP' (One-Time Password) protection?",
  "options": [
   "A permanent backup password if your main password is lost",
   "A single-use password valid for a very short time to verify identity",
   "To make onboarding new users look nicer",
   "To link a Telegram account to the corporate database"
  ],
  "explanation": "An OTP is short-lived and single-use, so a stolen code expires quickly. Even so, never share it."
 },
 "Manakah dari domain URL berikut yang merupakan domain resmi perusahaan PT Infran": {
  "question": "Which of these URL domains is the official domain of PT Infranexia?",
  "options": [
   "sso.infranexia-secure.com",
   "sso.infranexia.co.id",
   "sso.infranexia-portal.xyz",
   "sso.infranexia.xyz"
  ],
  "explanation": "The official domain must match exactly. A lookalike, or one that starts with the company name but ends in another domain, does not belong to the company."
 },
 "Protokol HTTPS (https://) di awal alamat URL menandakan bahwa:": {
  "question": "The HTTPS protocol (https://) at the start of a URL means that:",
  "options": [
   "The website is 100% safe and not a scam or phishing site",
   "The data connection between your browser and the server is encrypted",
   "The website has an internal SQLite database",
   "The website was built by the company's official IT team"
  ],
  "explanation": "HTTPS means data between the browser and the server is encrypted. It does not prove the site is trustworthy: scam sites can use HTTPS too."
 },
 "Anda melihat link dengan alamat: http://infranexia.co.id.attacker-domain.com/log": {
  "question": "You see a link with the address: http://infranexia.co.id.attacker-domain.com/login. Where will this link take you if clicked?",
  "options": [
   "infranexia.co.id (Official)",
   "attacker-domain.com (Attacker)",
   "Nowhere, because the link is broken",
   "To the Google login portal"
  ],
  "explanation": "What decides the destination is the domain right before the first slash. Here it is attacker-domain.com; 'infranexia.co.id' is only a fake subdomain placed in front."
 },
 "Taktik 'URL Shortener' (seperti bit.ly atau tinyurl) sering disalahgunakan peret": {
  "question": "The 'URL Shortener' tactic (such as bit.ly or tinyurl) is often abused by hackers to:",
  "options": [
   "Speed up loading of phishing sites",
   "Hide the real phishing URL so it looks unsuspicious",
   "Encrypt employees' password forms",
   "Automate sending phishing emails"
  ],
  "explanation": "URL shorteners hide the real address. Attackers use them so a harmful link looks ordinary. Check where it goes before opening it."
 },
 "Apa itu 'Quishing'?": {
  "question": "What is 'Quishing'?",
  "options": [
   "Phishing carried out through a voice phone call (vishing)",
   "Phishing that uses a fake QR code to lead to a harmful link",
   "Phishing that specifically targets financial data",
   "A phishing tactic that uses typosquatting domains"
  ],
  "explanation": "Quishing hides a harmful link behind a QR code. Do not scan QR codes from a source you do not trust."
 },
 "Anda mengarahkan kursor (hover) ke sebuah link di email kantor, teks link menuli": {
  "question": "You hover over a link in an office email. The link text says https://infranexia.co.id, but the browser tooltip in the bottom-left corner shows http://fake-login-leak.net. What does this mean?",
  "options": [
   "The link is safe because its text says infranexia.co.id",
   "The link leads to fake-login-leak.net and is a scam attempt",
   "Your browser has a rendering error",
   "The link has a double SSL certificate"
  ],
  "explanation": "Link text can be faked, but the destination address shown when you hover cannot. If they differ, it is a scam."
 }
}
