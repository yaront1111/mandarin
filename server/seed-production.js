// seed-production.js - Enhanced for production-ready data
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// --- Configuration ---
const MONGO_URI = 'mongodb://localhost:27017/mandarin';
const NUM_USERS = 200; // Reduced slightly for production
const MAX_PHOTOS_PER_USER = 7;
const NUM_LIKES_TO_SEED = 400;
const NUM_PHOTO_REQUESTS_TO_SEED = 200;
const SALT_ROUNDS = 12;
const ADMIN_EMAIL = 'yaront111@gmail.com'; // Admin email to preserve

// --- Import Mongoose Models ---
import User from './models/User.js';
import Like from './models/Like.js';
import PhotoPermission from './models/PhotoPermission.js';
import logger from './logger.js';

// --- Helper Functions ---
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Get multiple random elements without duplicates
const getRandomUniqueElements = (arr, count) => {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, arr.length));
};

// --- Enhanced Data for More Realistic Profiles ---

// Hebrew and English first names for realism
const hebrewFemaleNames = [
  'מאיה', 'נוע', 'תמר', 'שירה', 'יעל', 'אדל', 'ליאל', 'עדי', 'הילה', 'נועה',
  'אביגיל', 'אלה', 'שרה', 'טליה', 'רותם', 'מיכל', 'גפן', 'אוריה', 'אגם', 'שני',
  'אדווה', 'ליאור', 'שקד', 'אחינועם', 'ליאת', 'מאיה', 'אלונה', 'נטע', 'עלמה', 'אילה',
  'רוני', 'רננה', 'ענבר', 'שירלי', 'אורלי', 'חן', 'הדס', 'לירון', 'תהל', 'טל'
];

const hebrewMaleNames = [
  'אייל', 'נועם', 'איתי', 'יובל', 'אמיר', 'אסף', 'אורי', 'יהונתן', 'דניאל', 'יואב',
  'עידו', 'אלון', 'רועי', 'גיא', 'נדב', 'תומר', 'עומר', 'עמית', 'אורן', 'יותם',
  'עידן', 'אלעד', 'אופיר', 'מתן', 'אביב', 'ליאם', 'אריאל', 'טל', 'רז', 'רון',
  'שחר', 'יאיר', 'שגיא', 'ניר', 'דור', 'ברק', 'אלי', 'גל', 'נתנאל', 'אדם'
];

// Cool nicknames from dating sites (fictional but realistic)
const hebrewNicknames = [
  'הלוהט', 'חתיכה', 'מתוקה22', 'אספרסו', 'בייבי_בלו', 'הנסיכה', 'מלכת_הלילה', 'יפה_תואר',
  'הגבר_החלומי', 'רומנטיקן', 'לב_של_זהב', 'מישהי_מיוחדת', 'דוגמנית20', 'כוכב_הצפון', 'סקסית_ולוהטת',
  'אאוטלאו', 'המושלמת', 'סינדרלה', 'סקסי_בוי', 'קפה_שחור', 'אש_ולהבה', 'יהלום_נדיר', 'בלונדינית_מתוקה',
  'החלום_שלך', 'גבר_אמיתי', 'נשמה_יפה', 'עיניים_יפות', 'לב_חם', 'בחורה_סקסית', 'כישרונית',
  'גיבור_על', 'נמר_של_נייר', 'מיסטר_רייט', 'בחורה_לוהטת', 'רוק_סטאר', 'בן_גוריון', 'שרמנטי',
  'קסם_אישי', 'מלך_העולם', 'ספורטיבית', 'בוהמיין', 'בלונדיני_שובב', 'ברונטית_סקסית', 'רגיש_וחזק'
];

// Combined with English options for diversity
const firstNames = [
  // Add the Hebrew names first
  ...hebrewFemaleNames,
  
  // Female english names
  'Emma', 'Olivia', 'Ava', 'Isabella', 'Sophia', 'Mia', 'Charlotte', 'Amelia', 'Harper', 'Evelyn',
  'Abigail', 'Emily', 'Elizabeth', 'Sofia', 'Avery', 'Ella', 'Scarlett', 'Grace', 'Victoria', 'Riley',
  
  // Add Hebrew male names
  ...hebrewMaleNames,
  
  // Male english names
  'Liam', 'Noah', 'William', 'James', 'Oliver', 'Benjamin', 'Elijah', 'Lucas', 'Mason', 'Logan',
  'Alexander', 'Ethan', 'Jacob', 'Michael', 'Daniel', 'Henry', 'Jackson', 'Sebastian', 'Aiden', 'Matthew'
];

// Realistic Israeli last names
const lastNames = [
  // Hebrew last names
  'כהן', 'לוי', 'מזרחי', 'פרץ', 'ביטון', 'אברהם', 'פרידמן', 'שפירא', 'אזולאי', 'אוחיון',
  'דהן', 'חדד', 'אלון', 'שטרן', 'גולדשטיין', 'רוזנברג', 'שוורץ', 'קליין', 'הופמן', 'ברג',
  
  // English/international last names
  'Cohen', 'Levy', 'Mizrahi', 'Peretz', 'Biton', 'Avraham', 'Friedman', 'Shapira', 'Azoulay', 'Ochion',
  'Dahan', 'Hadad', 'Alon', 'Stern', 'Goldstein', 'Rosenberg', 'Schwartz', 'Klein', 'Hoffman', 'Berg'
];

// Generate couple names
const generateCoupleName = () => {
  const name1 = getRandomElement([...hebrewFemaleNames, ...hebrewMaleNames]);
  let name2 = getRandomElement([...hebrewFemaleNames, ...hebrewMaleNames]);
  while (name1 === name2) {
    name2 = getRandomElement([...hebrewFemaleNames, ...hebrewMaleNames]);
  }
  return `${name1} ו${name2}`;
};

// Generate username based on name or use a cool nickname
const generateUsername = (name) => {
  // 50% chance to use a cool nickname instead of name-based username
  if (Math.random() < 0.5) {
    return getRandomElement(hebrewNicknames) + getRandomInt(1, 99);
  }
  
  // Otherwise derive from name
  const parts = name.toLowerCase().replace(/[^a-zא-ת0-9]/g, ' ').split(' ').filter(p => p);
  if (parts.length === 0) return `user_${getRandomInt(1000, 9999)}`;

  const base = parts.join('');
  const num = getRandomInt(0, 999);
  return num > 0 ? `${base}${num}` : base;
};

// --- Enhanced Data Arrays ---
const roles = ["user", "user", "user", "user", "user", "moderator"];
const accountTiers = ["FREE", "PAID", "FEMALE", "COUPLE"];
const genders = ["male", "female", "non-binary", "other"];

// Israeli locations with Hebrew
const locations = [
  'תל אביב', 'ירושלים', 'חיפה', 'ראשון לציון', 'פתח תקווה', 'אשדוד', 'נתניה', 'באר שבע',
  'חולון', 'רמת גן', 'הרצליה', 'בת ים', 'כפר סבא', 'רעננה', 'מודיעין', 'אשקלון',
  'אילת', 'טבריה', 'נצרת', 'נהריה', 'עכו', 'לוד', 'רחובות', 'רמלה', 'חדרה'
];

// Interests with Hebrew options
const interestsBank = [
  // Hebrew interests
  "דייטים", "מסיבות", "קוקטיילים", "בישול", "אוכל טוב", "יין", "קפה", "חיי לילה", "ריקודים", 
  "מסעדות", "טיולים", "ים", "שחייה", "יוגה", "כושר", "ספורט", "כדורגל", "כדורסל", "טניס",
  "אמנות", "מוזיקה", "קולנוע", "תיאטרון", "ספרים", "קריאה", "כתיבה", "שירה", "צילום",
  "טיולי טבע", "חופים", "מחנאות", "מדבר", "עבודה", "קריירה", "יזמות", "השקעות", "נדל״ן",
  
  // English interests (still relevant to Israelis)
  "Dating", "Casual", "Friendship", "Long-term", "Travel", "Outdoors", "Movies", "Music", "Fitness",
  "Food", "Art", "Gaming", "Reading", "Tech", "Photography", "Cooking", "Dance", "Wine", "Beer",
  "Concerts", "Festivals", "Yoga", "Meditation", "Running", "Swimming", "Hiking", "Biking", "Tennis"
];

const iAmOptions = ["אישה", "גבר", "זוג", "woman", "man", "couple"];

const lookingForOptions = ["נשים", "גברים", "זוגות", "women", "men", "couples"];

const intoTagsOptions = [
  // Hebrew options
  'מפגשים', 'קינק', 'בדס״ם', 'סווינגרס', 'משחק קבוצתי', 'שלישיות', 'צ׳אטים', 'כיף וירטואלי',
  'משחקי תפקידים', 'אקסהיבישיוניזם', 'וויארציה', 'טנטרה', 'עיסוי חושני', 'חיבוקים', 'מכות',
  'קשירות', 'שליטה', 'כניעה', 'משמעת', 'צעצועים', 'לבני נשים', 'תחפושות', 'כפות רגליים',
  'שליטה באורגזמה', 'דחיית סיפוק', 'הקנטה', 'אוראלי', 'אנאלי', 'משחק ציבורי', 'צפייה', 'להיות נצפה',
  
  // English options
  'Meetups', 'Kink', 'BDSM', 'Swinging', 'Group play', 'Threesomes', 'Chatting', 'Online fun',
  'Role play', 'Exhibitionism', 'Voyeurism', 'Tantra', 'Sensual massage', 'Cuddling', 'Spanking',
  'Bondage', 'Dominance', 'Submission', 'Discipline', 'Toys', 'Lingerie', 'Costumes'
];

const turnOnsOptions = [
  // Hebrew options
  'דיבור מלוכלך', 'גוף חטוב', 'אינטליגנציה', 'הומור', 'ביטחון עצמי', 'דומיננטיות', 'כניעות',
  'מדים', 'הלבשה תחתונה', 'גרביונים', 'עקבים גבוהים', 'חליפות', 'קעקועים', 'פירסינג',
  'זקן', 'שיער ארוך', 'מגולח', 'טבעי', 'שרירי', 'מלאה', 'קטנה', 'גבוה',
  'מבטא', 'קול', 'חיוך', 'עיניים', 'ידיים', 'צוואר', 'גב', 'רגליים', 'ישבן', 'חזה',
  
  // English options
  'Dirty talk', 'Fit bodies', 'Intelligence', 'Humor', 'Confidence', 'Dominance', 'Submission',
  'Uniforms', 'Lingerie', 'Stockings', 'High heels', 'Suits', 'Tattoos', 'Piercings',
  'Beards', 'Long hair', 'Shaved', 'Natural', 'Muscular', 'Curvy', 'Petite', 'Tall'
];

const maritalStatusOptions = [
  // Hebrew options
  'רווק/ה', 'נשוי/אה', 'גרוש/ה', 'אלמן/ה', 'במערכת יחסים', 'זה מסובך', 'מערכת פתוחה', 'פוליאמורי/ת',
  
  // English options
  'Single', 'Married', 'Divorced', 'Widowed', 'In relationship', 'It\'s complicated', 'Open relationship', 'Polyamorous'
];

// Hebrew bio templates for more realistic profiles
const hebrewBioTemplates = [
  (details) => `היי שם! אני בן/בת ${details.age}, ${details.maritalStatus} ומתגורר/ת ב${details.location}. אוהב/ת ${details.interests[0] || 'לפגוש אנשים חדשים'} ו${details.interests[1] || 'לנהל שיחות טובות'}. מחפש/ת מישהו/י לחלוק איתו/ה חוויות מדהימות.`,

  (details) => `${details.maritalStatus} ${details.iAm} מ${details.location}. בן/בת ${details.age} עם המון אנרגיות. תשוקה ל${details.interests[0] || 'חיים'} ותמיד מוכן/ה ל${details.interests[1] || 'הרפתקאות'}. בוא/י נתחבר ונראה לאן זה יוביל!`,

  (details) => `החיים קצרים מכדי לא ליהנות מהם! ${details.iAm} בן/בת ${details.age} שאוהב/ת ${details.interests[0] || 'זמנים טובים'}. כשאני לא עובד/ת, תמצאו אותי ${details.interests[1] ? 'נהנה/ית מ' + details.interests[1] : 'מגלה מקומות חדשים'}. מחפש/ת חיבורים אמיתיים ב${details.location}.`,

  (details) => `מקומי/ת מ${details.location}, בן/בת ${details.age}. ${details.maritalStatus} ונהנה/ית מהחיים. אני ממש מתעניין/ת ב${details.interests[0] || 'בידור'} ו${details.interests[1] || 'תרבות'}. מעריך/ה כנות, כבוד ותקשורת טובה. בוא/י נשוחח ונראה אם יש קליק.`,

  (details) => `סתם ${details.iAm} שנהנה/ית מהדברים הטובים בחיים. בן/בת ${details.age}, גר/ה ב${details.location} היפה. ${details.maritalStatus}. התשוקות שלי כוללות ${details.interests[0] || 'טיולים'} ו${details.interests[1] || 'מפגשים עם אנשים חדשים'}. שלח/י הודעה אם את/ה מעוניין/ת לדעת עוד.`,

  (details) => `${details.iAm}, בן/בת ${details.age}, ${details.maritalStatus}. מבוסס/ת ב${details.location}. מחפש/ת זמנים כיפיים וקשרים משמעותיים. אוהב/ת ${details.interests[0] || 'הרפתקאות'} ו${details.interests[1] || 'תוכניות ספונטניות'}. אמור/י היי אם את/ה חושב/ת שנסתדר!`,

  (details) => `חי/ה את החיים הטובים ביותר ב${details.location}! ${details.iAm} בן/בת ${details.age}, ${details.maritalStatus}. כשאני לא עובד/ת, אני נהנה/ית מ${details.interests[0] || 'חברה'} ו${details.interests[1] || 'רגיעה'}. פתוח/ה לחוויות חדשות ולפגישות עם אנשים מעניינים.`,

  (details) => `${details.maritalStatus} ${details.iAm} מ${details.location}. בן/בת ${details.age} עם תשוקה ל${details.interests[0] || 'פגישות עם אנשים חדשים'} ו${details.interests[1] || 'ניסיון דברים חדשים'}. מחפש/ת חיבורים אמיתיים - החיים קצרים מכדי להסתפק בפחות!`,

  (details) => `שלום מ${details.location}! אני ${details.iAm} בן/בת ${details.age}, ${details.maritalStatus} ונהנה/ית מהחיים. התחומים שלי כוללים ${details.interests[0] || 'חברותא'}, ${details.interests[1] || 'כיף'}, ויצירת קשרים משמעותיים. בוא/י נדבר!`,

  (details) => `${details.iAm}, בן/בת ${details.age}. חי/ה ב${details.location} ואוהב/ת את זה! ${details.maritalStatus} ופתוח/ה לחוויות חדשות. יש לי תשוקה ל${details.interests[0] || 'חיים'} ו${details.interests[1] || 'חברה טובה'}. שלח/י הודעה אם אנחנו נראים מתאימים!`
];

// Bio templates for more realistic profiles in English
const englishBioTemplates = [
  (details) => `Hey there! I'm ${details.age}, ${details.maritalStatus.toLowerCase()} and living in ${details.location}. I love ${details.interests[0] || 'meeting new people'} and ${details.interests[1] || 'having good conversations'}. Looking for someone to share amazing experiences with.`,

  (details) => `${details.maritalStatus} ${details.iAm} based in ${details.location}. ${details.age} years young and full of energy. Passionate about ${details.interests[0] || 'life'} and always up for ${details.interests[1] || 'adventures'}. Let's connect and see where it goes!`,

  (details) => `Life is too short not to enjoy it! ${details.age}-year-old ${details.iAm} who loves ${details.interests[0] || 'good times'}. When I'm not working, you'll find me ${details.interests[1] ? 'enjoying ' + details.interests[1] : 'exploring new places'}. Looking for genuine connections in ${details.location}.`,

  (details) => `${details.location} native, ${details.age} years old. ${details.maritalStatus} and enjoying life. I'm deeply into ${details.interests[0] || 'entertainment'} and ${details.interests[1] || 'culture'}. I value honesty, respect, and good communication. Let's chat and see if we click.`,

  (details) => `Just a ${details.iAm} who enjoys the finer things in life. ${details.age}, living in beautiful ${details.location}. ${details.maritalStatus}. My passions include ${details.interests[0] || 'traveling'} and ${details.interests[1] || 'meeting new people'}. Message me if you're interested in knowing more.`
];

// Combined bio templates
const bioTemplates = [...hebrewBioTemplates, ...englishBioTemplates];

// --- Enhanced Photo Collections ---
// First, create a directory to save our seed photos
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedPhotoDir = path.join(__dirname, 'uploads', 'seed');
if (!fs.existsSync(seedPhotoDir)) {
  fs.mkdirSync(seedPhotoDir, { recursive: true });
}

// Define better stock photo collections (artistic, non-identifiable)
const photoCollections = {
  woman: [
    // Back/side views, artistic shots, tasteful partial/silhouettes
    "https://images.unsplash.com/photo-1534954553104-88cb75be7648?q=80&w=800", // Woman looking away at sunset
    "https://images.unsplash.com/photo-1551361999-b9af8498096b?q=80&w=800", // Silhouette woman near window
    "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?q=80&w=800", // Woman on beach from behind
    "https://images.unsplash.com/photo-1502716119720-b23a93e5fe1b?q=80&w=800", // Woman with hat hiding face
    "https://images.unsplash.com/photo-1523264939339-c89f9dadde2e?q=80&w=800", // Woman's back in sunlight
    "https://images.unsplash.com/photo-1563178406-4cdc2923acbc?q=80&w=800", // Woman with umbrella hiding face
    "https://images.unsplash.com/photo-1503185912284-5271ff81b9a8?q=80&w=800", // Dancing silhouette
    "https://images.unsplash.com/photo-1553335262-415c3a7e9e5c?q=80&w=800", // Woman from behind in doorway
    "https://images.unsplash.com/photo-1561363702-e07252da3399?q=80&w=800", // Woman at sunset from distance
    "https://images.unsplash.com/photo-1552642986-ccb41e7059e7?q=80&w=800", // Woman facing away at beach
    "https://images.unsplash.com/photo-1604198183164-6665f471441b?q=80&w=800", // Artistic shadow portrait
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=800", // Beach walk silhouette
    "https://images.unsplash.com/photo-1536765659537-1f114b539354?q=80&w=800", // Woman with flowers hiding face
    "https://images.unsplash.com/photo-1548365328-8c6db3220e4c?q=80&w=800", // Reflection only
    "https://images.unsplash.com/photo-1542295474-5e57be0a5bf3?q=80&w=800"  // Backlit silhouette
  ],
  man: [
    // Back/side views, artistic shots, tasteful partial/silhouettes
    "https://images.unsplash.com/photo-1529957405172-1178f4e8ded4?q=80&w=800", // Man looking at mountains
    "https://images.unsplash.com/photo-1552642986-ccb41e7059e7?q=80&w=800", // Man at beach from behind
    "https://images.unsplash.com/photo-1580332449413-bd9800271429?q=80&w=800", // Man in suit from behind
    "https://images.unsplash.com/photo-1563203369-26f2e4a5ccf9?q=80&w=800", // Man silhouette at sunset
    "https://images.unsplash.com/photo-1504899567410-7501a313fab5?q=80&w=800", // Back view on cliff
    "https://images.unsplash.com/photo-1545167496-906991e04751?q=80&w=800", // Man facing away in forest
    "https://images.unsplash.com/photo-1552058301-f8a469ac1d93?q=80&w=800", // Side view silhouette
    "https://images.unsplash.com/photo-1500835196732-c37be4308bdd?q=80&w=800", // Man looking at mountains distance
    "https://images.unsplash.com/photo-1546057961-fc55d8782620?q=80&w=800", // Back view in cafe
    "https://images.unsplash.com/photo-1526887520775-4b14b8aed925?q=80&w=800", // Distant figure on beach
    "https://images.unsplash.com/photo-1536745287225-21d689278bb1?q=80&w=800", // Silhouette against sunset
    "https://images.unsplash.com/photo-1461468611824-46457c0e11fd?q=80&w=800", // Man from behind in city
    "https://images.unsplash.com/photo-1505022610485-0249645e9d11?q=80&w=800", // Hiking silhouette
    "https://images.unsplash.com/photo-1543132685-cd9f9b1652e8?q=80&w=800", // Back view on dock
    "https://images.unsplash.com/photo-1503023345310-bd7c1de61c7d?q=80&w=800"  // Artistic back portrait
  ],
  couple: [
    // Back/side views, artistic shots, tasteful partial/silhouettes - couples
    "https://images.unsplash.com/photo-1538838849677-c3ae1dec8d80?q=80&w=800", // Couple looking at sunset
    "https://images.unsplash.com/photo-1537212013699-ea3dc01a754a?q=80&w=800", // Couple from behind holding hands
    "https://images.unsplash.com/photo-1622553719828-eb3b73029952?q=80&w=800", // Couple silhouette beach sunset
    "https://images.unsplash.com/photo-1491438590914-bc09fcaaf77a?q=80&w=800", // Couple dancing silhouette
    "https://images.unsplash.com/photo-1533777857889-4be7c70b33f7?q=80&w=800", // Couple from distance on beach
    "https://images.unsplash.com/photo-1536821553111-c9a579cbc5b5?q=80&w=800", // Couple from behind in nature
    "https://images.unsplash.com/photo-1472653431158-6364773b2fda?q=80&w=800", // Couple holding hands walking away
    "https://images.unsplash.com/photo-1513279922550-250c2129b13a?q=80&w=800", // Couple silhouette mountain
    "https://images.unsplash.com/photo-1488116504335-4a916f1f4c51?q=80&w=800", // Couple back view beach
    "https://images.unsplash.com/photo-1549221952-37f489961f24?q=80&w=800", // Couple from behind on dock
    "https://images.unsplash.com/photo-1526382551041-3c817fc3d478?q=80&w=800", // Couple shadows
    "https://images.unsplash.com/photo-1516588742049-ef4b65b001dd?q=80&w=800", // Couple silhouette sunset
    "https://images.unsplash.com/photo-1525803377221-4f6ccdaa5133?q=80&w=800", // Couple backs on mountain
    "https://images.unsplash.com/photo-1518623489648-a173ef7824f3?q=80&w=800", // Couple from behind hiking
    "https://images.unsplash.com/photo-1604944837351-8971e14aa416?q=80&w=800"  // Couple from behind city
  ]
};

// --- Main Seeding Function ---
const seedDatabase = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    logger.info('MongoDB Connected for production seeding...');

    // --- Check for Admin User ---
    const adminExists = await User.findOne({ email: ADMIN_EMAIL });
    
    if (adminExists) {
      logger.info(`Admin user ${ADMIN_EMAIL} already exists. Will be preserved.`);
      
      // Ensure admin has proper role and tier
      if (adminExists.role !== 'admin') {
        await User.findByIdAndUpdate(adminExists._id, { role: 'admin' });
        logger.info(`Updated ${ADMIN_EMAIL} to admin role.`);
      }
    } else {
      logger.warn(`Admin user ${ADMIN_EMAIL} not found. Will create one.`);
      
      // Create admin user if not exists
      const adminPassword = await bcrypt.hash('admin123', SALT_ROUNDS);
      const adminUser = new User({
        nickname: 'Admin',
        username: 'admin',
        email: ADMIN_EMAIL,
        password: adminPassword,
        role: 'admin',
        accountTier: 'PAID',
        isVerified: true,
        active: true
      });
      
      await adminUser.save();
      logger.info(`Created admin user ${ADMIN_EMAIL}`);
    }

    // --- Check Existing User Count ---
    const existingUserCount = await User.countDocuments({});
    logger.info(`Found ${existingUserCount} existing users.`);

    if (existingUserCount > NUM_USERS) {
      logger.warn(`Database already has ${existingUserCount} users, which exceeds the target of ${NUM_USERS}.`);
      logger.warn('Skipping user creation but will add missing data to existing users if needed.');
    } else {
      // Calculate how many more users we need to create
      const usersToCreate = NUM_USERS - existingUserCount;
      logger.info(`Will create ${usersToCreate} additional users.`);

      // --- Clear Existing Fake Data (but preserve real users) ---
      // In a real production scenario, you might want to be more careful here
      if (usersToCreate > 0) {
        logger.warn('Removing seed-generated data only...');
        await User.deleteMany({ 'details.seedGenerated': true });
        await Like.deleteMany({});
        await PhotoPermission.deleteMany({});
        logger.info('Seed-generated data cleared.');
      }

      // Get all existing users again (after deletion of seed users)
      const existingUsers = await User.find({});
      const createdUserIds = existingUsers.map(user => user._id.toString());
      let createdUsers = [...existingUsers];

      // --- 1. Seed Users with Better Data ---
      logger.info(`Seeding ${usersToCreate} users with realistic profiles...`);
      for (let i = 0; i < usersToCreate; i++) {
        // Decide user type first to guide other selections
        const iAm = getRandomElement(iAmOptions);

        // Generate appropriate name based on user type
        let nickname;
        if (iAm === 'זוג' || iAm === 'couple') {
          nickname = generateCoupleName();
        } else if (iAm === 'אישה' || iAm === 'woman') {
          nickname = getRandomElement([...hebrewFemaleNames, ...firstNames.slice(0, 20)]); // Use female names
        } else { // man
          nickname = getRandomElement([...hebrewMaleNames, ...firstNames.slice(40)]); // Use male names
        }

        // Add a last name sometimes for individuals
        if ((iAm !== 'זוג' && iAm !== 'couple') && Math.random() > 0.5) {
          nickname = `${nickname} ${getRandomElement(lastNames)}`;
        }

        // Generate matching username or use a cool nickname
        const username = generateUsername(nickname);

        // Generate appropriate looking for options
        let lookingFor;
        if (iAm === 'זוג' || iAm === 'couple') {
          // Couples typically look for women, men, or other couples
          lookingFor = getRandomUniqueElements(lookingForOptions, getRandomInt(1, 3));
        } else if (iAm === 'אישה' || iAm === 'woman') {
          // More variety in what women might look for
          lookingFor = getRandomUniqueElements(lookingForOptions, getRandomInt(1, 3));
        } else { // man
          // Men might look for women, couples, or less frequently men
          const preferences = Math.random() < 0.8 ? 
            ['נשים', 'זוגות', 'women', 'couples'] : 
            lookingForOptions;
          lookingFor = getRandomUniqueElements(preferences, getRandomInt(1, preferences.length));
        }

        // Select gender based on iAm
        let gender;
        if (iAm === 'אישה' || iAm === 'woman') {
          gender = 'female';
        } else if (iAm === 'גבר' || iAm === 'man') {
          gender = 'male';
        } else { // couple
          gender = getRandomElement(['male', 'female']); // Represent primary account holder
        }

        // Set age ranges more realistically
        let age;
        if (iAm === 'זוג' || iAm === 'couple') {
          age = getRandomInt(25, 55); // Couples tend to be a bit older
        } else {
          age = getRandomInt(21, 60); // Individual age range
        }

        // Select appropriate account tier
        let accountTier;
        if (iAm === 'אישה' || iAm === 'woman') {
          accountTier = Math.random() < 0.7 ? 'FEMALE' : getRandomElement(['FREE', 'PAID']);
        } else if (iAm === 'זוג' || iAm === 'couple') {
          accountTier = Math.random() < 0.6 ? 'COUPLE' : getRandomElement(['FREE', 'PAID']);
        } else { // man
          accountTier = Math.random() < 0.4 ? 'PAID' : 'FREE';
        }

        // Select interest count based on account tier
        const interestCount = accountTier === 'FREE' ? getRandomInt(2, 5) : getRandomInt(4, 8);

        // Select non-duplicate interests
        const interests = getRandomUniqueElements(interestsBank, interestCount);

        // Select non-duplicate into tags - more for paid accounts
        const intoTagsCount = accountTier === 'FREE' ? getRandomInt(2, 4) : getRandomInt(3, 7);
        const intoTags = getRandomUniqueElements(intoTagsOptions, intoTagsCount);

        // Select non-duplicate turn-ons - more for paid accounts
        const turnOnsCount = accountTier === 'FREE' ? getRandomInt(2, 4) : getRandomInt(3, 6);
        const turnOns = getRandomUniqueElements(turnOnsOptions, turnOnsCount);

        // Select marital status appropriate to user type
        let maritalStatus;
        if (iAm === 'זוג' || iAm === 'couple') {
          maritalStatus = getRandomElement(['נשוי/אה', 'במערכת יחסים', 'מערכת פתוחה', 'פוליאמורי/ת', 'Married', 'In relationship', 'Open relationship']);
        } else {
          maritalStatus = getRandomElement(maritalStatusOptions);
        }

        // Build user details object
        const userDetails = {
          age,
          gender,
          location: getRandomElement(locations),
          interests,
          iAm,
          lookingFor,
          intoTags,
          turnOns,
          maritalStatus,
          seedGenerated: true // Mark as generated by seed for future reference
        };

        // Generate bio using templates - 70% Hebrew, 30% English
        const bioTemplate = Math.random() < 0.7 ? 
          getRandomElement(hebrewBioTemplates) : 
          getRandomElement(englishBioTemplates);
        userDetails.bio = bioTemplate(userDetails);

        // Create the final user object
        const plainPassword = 'password123';
        const hashedPassword = await bcrypt.hash(plainPassword, SALT_ROUNDS);

        const userData = {
          nickname,
          username,
          email: `${username}@example.com`,
          password: hashedPassword,
          role: getRandomElement(roles),
          accountTier,
          details: userDetails,
          isOnline: Math.random() < 0.3,
          lastActive: new Date(Date.now() - getRandomInt(0, 1000 * 60 * 60 * 24 * 14)), // More recent activity
          photos: [],
          isVerified: true,
          active: true,
        };

        try {
          const newUser = new User(userData);
          const savedUser = await newUser.save();
          createdUserIds.push(savedUser._id.toString());
          createdUsers.push(savedUser);

          if ((i + 1) % 50 === 0) {
            logger.info(`Created ${i + 1} users so far...`);
          }
        } catch (error) {
          logger.error(`Error creating user ${nickname}: ${error.message}. Skipping user.`);
          if (error.code === 11000) {
            logger.warn(`Duplicate key error for user ${nickname}. Might be email/nickname collision.`);
          }
          if (error.errors) {
            Object.keys(error.errors).forEach(key => {
              logger.error(`Validation Error (${key}): ${error.errors[key].message}`);
            });
          }
        }
      }

      logger.info(`Successfully created ${createdUserIds.length} total users.`);
      if (createdUserIds.length === 0) {
        logger.error("No users were created. Aborting further seeding.");
        return;
      }
    }

    // Reload all users after creation to ensure we're working with the latest data
    createdUsers = await User.find({});
    const createdUserIds = createdUsers.map(user => user._id.toString());

    // --- 2. Seed Photos with appropriate images ---
    logger.info('Seeding photos for users with appropriate images...');
    const allPrivatePhotoIdsWithOwner = [];

    for (const user of createdUsers) {
      // Skip if user already has photos
      if (user.photos && user.photos.length > 0) {
        logger.info(`User ${user.nickname} already has ${user.photos.length} photos. Skipping.`);
        
        // Still collect private photo IDs for permission seeding
        user.photos.forEach((photo) => {
          if (photo.isPrivate && photo._id) {
            allPrivatePhotoIdsWithOwner.push({
              photoId: photo._id.toString(),
              ownerId: user._id.toString()
            });
          }
        });
        continue;
      }

      const userType = user.details?.iAm || 'default';
      let photoCollection;
      
      // Map Hebrew types to English collection keys
      if (userType === 'אישה') photoCollection = photoCollections.woman;
      else if (userType === 'גבר') photoCollection = photoCollections.man;
      else if (userType === 'זוג') photoCollection = photoCollections.couple;
      else photoCollection = photoCollections[userType] || photoCollections.man;

      // Determine how many photos based on account tier
      let numPhotos;
      if (user.accountTier === 'PAID' || user.accountTier === 'FEMALE' || user.accountTier === 'COUPLE') {
        numPhotos = getRandomInt(3, MAX_PHOTOS_PER_USER);
      } else {
        numPhotos = getRandomInt(1, 3); // Free accounts get fewer photos
      }

      // Shuffle the collection and take the first numPhotos
      const shuffledPhotos = [...photoCollection].sort(() => 0.5 - Math.random());
      const selectedPhotos = shuffledPhotos.slice(0, numPhotos);

      const photosToAdd = [];

      // Add the profile picture first (public)
      photosToAdd.push({
        url: selectedPhotos[0],
        isPrivate: false,
        metadata: {
          uploadedBySeed: true,
          originalName: `${userType}_profile.jpg`,
          uploadDate: new Date(Date.now() - getRandomInt(0, 1000 * 60 * 60 * 24 * 30))
        }
      });

      // Add additional photos (some private)
      for (let p = 1; p < selectedPhotos.length; p++) {
        // Higher tier accounts have more private photos
        const isPrivate = user.accountTier !== 'FREE' && Math.random() < 0.5;

        const photoData = {
          url: selectedPhotos[p],
          isPrivate: isPrivate,
          metadata: {
            uploadedBySeed: true,
            originalName: `${userType}_photo_${p + 1}.jpg`,
            uploadDate: new Date(Date.now() - getRandomInt(0, 1000 * 60 * 60 * 24 * 20))
          }
        };
        photosToAdd.push(photoData);
      }

      if (photosToAdd.length > 0) {
        try {
          // Update user directly
          const updatedUser = await User.findByIdAndUpdate(
            user._id,
            { $set: { photos: photosToAdd } },
            { new: true }
          );

          if (updatedUser) {
            // Record private photo IDs from the updated user document
            updatedUser.photos.forEach((photo) => {
              if (photo.isPrivate && photo._id) {
                allPrivatePhotoIdsWithOwner.push({
                  photoId: photo._id.toString(),
                  ownerId: updatedUser._id.toString()
                });
              }
            });
          } else {
            logger.warn(`Could not find user ${user.nickname} to add photos after creation.`);
          }
        } catch(error) {
          logger.error(`Error adding photos for user ${user.nickname}: ${error.message}. Skipping photos for this user.`);
        }
      }
    }

    logger.info(`Finished seeding photos. ${allPrivatePhotoIdsWithOwner.length} private photos recorded.`);

    // --- 3. Seed Likes with Better Distribution---
    // Only seed likes if we have few existing ones
    const existingLikesCount = await Like.countDocuments({});
    logger.info(`Found ${existingLikesCount} existing likes.`);
    
    if (existingLikesCount < NUM_LIKES_TO_SEED) {
      const likesToCreate = NUM_LIKES_TO_SEED - existingLikesCount;
      logger.info(`Seeding ${likesToCreate} additional likes with improved distribution...`);
      let likesCreated = 0;

      // Create a map of users by type for more realistic matching
      const usersByType = {
        woman: createdUsers.filter(u => u.details?.iAm === 'woman' || u.details?.iAm === 'אישה').map(u => u._id.toString()),
        man: createdUsers.filter(u => u.details?.iAm === 'man' || u.details?.iAm === 'גבר').map(u => u._id.toString()),
        couple: createdUsers.filter(u => u.details?.iAm === 'couple' || u.details?.iAm === 'זוג').map(u => u._id.toString())
      };

      for (let i = 0; i < likesToCreate; i++) {
        if (createdUserIds.length < 2) break;

        // Select a random sender
        const senderId = getRandomElement(createdUserIds);
        const sender = createdUsers.find(u => u._id.toString() === senderId);

        if (!sender || !sender.details || !sender.details.iAm || !sender.details.lookingFor) {
          continue; // Skip if sender details are missing
        }

        // Find users that match what the sender is looking for
        let potentialRecipients = [];

        sender.details.lookingFor.forEach(lookingFor => {
          // Handle both Hebrew and English lookingFor options
          if (lookingFor === 'women' || lookingFor === 'נשים') {
            potentialRecipients = [...potentialRecipients, ...usersByType.woman];
          } else if (lookingFor === 'men' || lookingFor === 'גברים') {
            potentialRecipients = [...potentialRecipients, ...usersByType.man];
          } else if (lookingFor === 'couples' || lookingFor === 'זוגות') {
            potentialRecipients = [...potentialRecipients, ...usersByType.couple];
          }
        });

        // Remove duplicates and the sender from potential recipients
        potentialRecipients = [...new Set(potentialRecipients)].filter(id => id !== senderId);

        if (potentialRecipients.length === 0) {
          continue; // Skip if no valid recipients
        }

        const recipientId = getRandomElement(potentialRecipients);

        try {
          const existingLike = await Like.findOne({ sender: senderId, recipient: recipientId });
          if (!existingLike) {
            const newLike = new Like({
              sender: senderId,
              recipient: recipientId,
              createdAt: new Date(Date.now() - getRandomInt(0, 1000 * 60 * 60 * 24 * 30)), // Random time within last month
              updatedAt: new Date(Date.now() - getRandomInt(0, 1000 * 60 * 60 * 24 * 15))
            });
            await newLike.save();
            likesCreated++;
          }
        } catch (error) {
          if (error.code !== 11000) {
            logger.error(`Error creating like: ${error.message}`);
          }
        }

        if (likesCreated > 0 && likesCreated % 100 === 0) {
          logger.info(`Seeded ${likesCreated} likes so far...`);
        }
      }

      logger.info(`Seeded ${likesCreated} unique likes.`);
    } else {
      logger.info(`Already have ${existingLikesCount} likes, which exceeds target. Skipping like creation.`);
    }

    // --- 4. Seed Photo Requests with Better Distribution ---
    // Only seed photo requests if we have few existing ones
    const existingRequestsCount = await PhotoPermission.countDocuments({});
    logger.info(`Found ${existingRequestsCount} existing photo permission requests.`);
    
    if (existingRequestsCount < NUM_PHOTO_REQUESTS_TO_SEED && allPrivatePhotoIdsWithOwner.length > 0) {
      const requestsToCreate = NUM_PHOTO_REQUESTS_TO_SEED - existingRequestsCount;
      logger.info(`Seeding ${requestsToCreate} photo permission requests...`);
      let requestsCreated = 0;

      if (allPrivatePhotoIdsWithOwner.length > 0 && createdUserIds.length > 1) {
        for (let i = 0; i < requestsToCreate; i++) {
          if (allPrivatePhotoIdsWithOwner.length === 0) break;

          const randomPhotoIndex = getRandomInt(0, allPrivatePhotoIdsWithOwner.length - 1);
          const { photoId, ownerId } = allPrivatePhotoIdsWithOwner[randomPhotoIndex];

          // Get the owner details to match appropriate requesters
          const owner = createdUsers.find(u => u._id.toString() === ownerId);

          if (!owner || !owner.details || !owner.details.iAm) {
            continue; // Skip if owner details missing
          }

          // Find potential requesters based on what type the owner is and who might be interested
          let potentialRequesters = [];
          
          // Handle both Hebrew and English iAm values
          const ownerType = owner.details.iAm;
          
          if (ownerType === 'woman' || ownerType === 'אישה') {
            // Women's photos might be requested by men, couples, and some women
            potentialRequesters = [
              ...createdUsers.filter(u => (u.details?.iAm === 'man' || u.details?.iAm === 'גבר')).map(u => u._id.toString()),
              ...createdUsers.filter(u => (u.details?.iAm === 'couple' || u.details?.iAm === 'זוג')).map(u => u._id.toString()),
              ...createdUsers.filter(u => (u.details?.iAm === 'woman' || u.details?.iAm === 'אישה')).filter(() => Math.random() < 0.3).map(u => u._id.toString())
            ];
          } else if (ownerType === 'man' || ownerType === 'גבר') {
            // Men's photos might be requested by women, couples, and some men
            potentialRequesters = [
              ...createdUsers.filter(u => (u.details?.iAm === 'woman' || u.details?.iAm === 'אישה')).map(u => u._id.toString()),
              ...createdUsers.filter(u => (u.details?.iAm === 'couple' || u.details?.iAm === 'זוג')).map(u => u._id.toString()),
              ...createdUsers.filter(u => (u.details?.iAm === 'man' || u.details?.iAm === 'גבר')).filter(() => Math.random() < 0.3).map(u => u._id.toString())
            ];
          } else { // couple
            // Couple photos might be requested by everyone
            potentialRequesters = [...createdUserIds];
          }

          // Remove duplicates and the owner from potential requesters
          potentialRequesters = [...new Set(potentialRequesters)].filter(id => id !== ownerId);

          if (potentialRequesters.length === 0) {
            continue; // Skip if no valid requesters
          }

          const requesterId = getRandomElement(potentialRequesters);

          try {
            const existingRequest = await PhotoPermission.findOne({
              photo: photoId,
              requestedBy: requesterId
            });

            if (!existingRequest) {
              // Determine a random status with appropriate weighting
              const statusOptions = ['pending', 'approved', 'rejected'];
              const statusWeights = [0.5, 0.3, 0.2]; // 50% pending, 30% approved, 20% rejected

              const randomValue = Math.random();
              let status;
              let cumulativeWeight = 0;

              for (let i = 0; i < statusOptions.length; i++) {
                cumulativeWeight += statusWeights[i];
                if (randomValue <= cumulativeWeight) {
                  status = statusOptions[i];
                  break;
                }
              }

              const newRequest = new PhotoPermission({
                photo: photoId,
                requestedBy: requesterId,
                photoOwnerId: ownerId,
                status,
                createdAt: new Date(Date.now() - getRandomInt(0, 1000 * 60 * 60 * 24 * 20)),
                updatedAt: new Date(Date.now() - getRandomInt(0, 1000 * 60 * 60 * 24 * 10))
              });

              await newRequest.save();
              requestsCreated++;
            }
          } catch (error) {
            if (error.code !== 11000) {
              logger.error(`Error creating photo permission request: ${error.message}`);
            }
          }

          if (requestsCreated > 0 && requestsCreated % 50 === 0) {
            logger.info(`Seeded ${requestsCreated} photo requests so far...`);
          }
        }

        logger.info(`Seeded ${requestsCreated} unique photo permission requests.`);
      } else {
        logger.warn('Skipping photo request seeding: Not enough users or no private photos found.');
      }
    } else {
      logger.info(`Already have ${existingRequestsCount} photo requests or no private photos. Skipping photo request creation.`);
    }

    // --- Final Check: Ensure Admin User is Preserved ---
    const finalAdminCheck = await User.findOne({ email: ADMIN_EMAIL });
    if (finalAdminCheck && finalAdminCheck.role === 'admin') {
      logger.info(`✅ Admin user ${ADMIN_EMAIL} successfully preserved/created with admin role.`);
    } else if (finalAdminCheck) {
      await User.findByIdAndUpdate(finalAdminCheck._id, { role: 'admin' });
      logger.info(`✅ Admin user ${ADMIN_EMAIL} role updated to admin.`);
    } else {
      logger.error(`❌ Admin user ${ADMIN_EMAIL} not found at end of seeding process!`);
    }

    logger.info('Production-ready database seeding completed successfully!');

  } catch (error) {
    logger.error('Production database seeding failed:', error);
  } finally {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected.');
  }
};

// Run the seeding function
seedDatabase();