// seed-production.js - Enhanced for Israeli adult dating site authenticity

import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import process from 'process';

// --- Configuration ---
const MONGO_URI = 'mongodb://localhost:27017/mandarin';
const NUM_USERS = 200;
const MAX_PHOTOS_PER_USER = 7;
const NUM_LIKES_TO_SEED = 400;
const NUM_PHOTO_REQUESTS_TO_SEED = 200;
const SALT_ROUNDS = 12;
const ADMIN_EMAIL = 'yaront111@gmail.com';

// Check for --clean flag to completely clean the database
const CLEAN_DATABASE = process.argv.includes('--clean');

// --- Import Mongoose Models ---
import User from './models/User.js';
import Like from './models/Like.js';
import PhotoPermission from './models/PhotoPermission.js';
import logger from './logger.js';

// --- Helper Functions ---
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];
const getRandomUniqueElements = (arr, count) => {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, arr.length));
};

// --- Enhanced Data for Israeli Adult Dating Profiles ---

// Hebrew female names - keeping authentic
const hebrewFemaleNames = [
  'מאיה', 'נועה', 'יעל', 'שירה', 'מיכל', 'הילה', 'ליאל', 'שני', 'עדי', 'אדל',
  'רותם', 'גפן', 'טליה', 'רוני', 'דנה', 'אלה', 'שיר', 'שקד', 'עלמה', 'יסמין',
  'מיקה', 'אביגיל', 'ענבר', 'נטע', 'אילה', 'שירלי', 'לירון', 'דניאל', 'נופר', 'גלי'
];

// Hebrew male names - keeping authentic
const hebrewMaleNames = [
  'איתי', 'יובל', 'עומר', 'אמיר', 'אורי', 'רועי', 'נועם', 'יונתן', 'אלון', 'דניאל',
  'אייל', 'אסף', 'עידו', 'גיא', 'נדב', 'תומר', 'עמית', 'ניר', 'אלעד', 'רון',
  'דור', 'יואב', 'טל', 'שחר', 'עידן', 'אופיר', 'מתן', 'אריאל', 'יאיר', 'עמרי'
];

// Flirtatious Israeli dating site nicknames - more suggestive and adult-oriented
const hebrewNicknames = [
  // More suggestive male nicknames
  'גבר_חם', 'ישראלי_סקסי', 'תל_אביבי_לוהט', 'חתיך_בפוטנציאל', 'מפנק_ומפונק', 'פנוי_להכיר',
  'חזק_ועדין', 'שיודע_מה_רוצה', 'מחפש_ריגושים', 'דיסקרטי_ואיכותי', 'רומנטיקן_סוער',
  'מנוסה_וחושני', 'גבר_ביטחון', 'מפתיע_במיטה', 'חוש_הומור_חריף', 'הרפתקן_במיטה',
  'ספורטיבי_וסקסי', 'ישראלי_חושני', 'חם_וחשוק', 'לוהט_בתחום', 'גבר_פראי',
  'גבר_בשל', 'לילות_לוהטים', 'הנאות_אסורות', 'ישראלי_אתלטי', 'עיניים_כחולות_ודומיננטי', 
  'משחרר_עכבות', 'גבר_חזק_ורגיש', 'שרירי_ומפנק', 'דירה_דיסקרטית', 'נשוי_ומסקרן',
  'גרוש_במיטבו', 'ירושלמי_משוחרר', 'מסג_חושני', 'בן40_וסוער', 'הדבר_האמיתי',

  // More suggestive female nicknames
  'מתוקה_ופיקנטית', 'בחורה_חושנית', 'אישה_סקסית', 'משחררת_רסן', 'מפנקת_בטירוף',
  'מעוניינת_בהנאות', 'חושנית_ולוהטת', 'נועזת_וסקסית', 'אוהבת_פינוקים', 'אישה_מסקרנת',
  'פראית_ועדינה', 'תל_אביבית_חמה', 'ספונטנית_במיטה', 'יודעת_מה_רוצה', 'בחורה_חריפה',
  'רעננה_ורותחת', 'אישה_משוחררת', 'לוהטת_ונועזת', 'מגרה_חושים', 'יפה_ומושכת',
  'רגליים_ארוכות', 'נשואה_משועממת', 'מפתיעה_במיטה', 'לוהטת_מבפנים', 'שדיים_מושלמים', 
  'בת30_ונועזת', 'בלונדינית_סקסית', 'קעקועים_מסקרנים', 'אוהבת_לשחק', 'אדומת_שיער_וסקסית',
  'גבוהה_ומפתה', 'אישה_בשלה', 'בת_טובים_חושנית', 'נשית_ומסחררת', 'מחפשת_ריגושים',

  // Couple nicknames for adult context
  'זוג_פתוח', 'צמד_חושני', 'זוג_מסקרן', 'פנויים_להכיר', 'אוהבים_וחוקרים',
  'חברים_בלב_ובגוף', 'מנוסים_ופתוחים', 'משחררים_עכבות', 'זוג_משוחרר', 'ספונטניים_ביחד',
  'מחפשים_חברים', 'נשואים_ופתוחים', 'זוג_דיסקרטי', 'אוהבים_לגוון', 'זוג_איכותי',
  'היא_ביונית_הוא_סקרן', 'מחפשים_בחורה', 'פתוחים_להכל', 'נשואים_נועזים', 'מחפשים_שלישיה',
  'אוהבים_להתנסות', 'היא_בת25_הוא_40', 'דירה_פרטית_בתא', 'נפגשים_להנאות', 'מזמינים_להצטרף'
];

// Israeli locations with Hebrew
const locations = [
  'תל אביב', 'תל אביב צפון', 'רמת אביב', 'פלורנטין', 'רוטשילד', 'הרצליה פיתוח', 'רמת השרון',
  'רעננה', 'כפר סבא', 'נתניה', 'ראשון לציון', 'אשדוד', 'אשקלון', 'מודיעין', 'ירושלים',
  'חיפה', 'קריות', 'באר שבע', 'אילת', 'הוד השרון', 'פתח תקווה', 'רמת גן', 'בת ים',
  'גבעתיים', 'לוד', 'רחובות', 'רמלה', 'אור יהודה', 'יפו', 'רמת הגולן', 'זכרון יעקב'
];

// Adult-oriented interests with Hebrew options
const interestsBank = [
  // Hebrew leisure activities
  "בילויים", "מסיבות", "ריקודים", "קוקטיילים", "אוכל טוב", "יין איכותי", "בתי קפה", "ברים",
  "מועדונים", "חיי לילה", "מסעדות גורמה", "הופעות", "פסטיבלים", "טיולים בארץ", "ים", "חופים",
  "שחייה", "יוגה", "כושר", "ספורט", "אומנות", "קולנוע", "הצגות", "מוזיקה", "ספרים", "צילום",

  // More intimate/suggestive interests in Hebrew
  "עיסויים", "ערבים רומנטיים", "ספא זוגי", "חופשות ספונטניות", "חוויות חדשות", "ריקודי זוגות",
  "יין וגבינות", "ערבי כיף", "בילויים זוגיים", "אינטימיות", "שיחות עמוקות", "מפגשים ספונטניים",
  "חיבורים אמיתיים", "גיבוש זוגות", "משחקי תפקידים", "משחקי זוגות", "ערבי גיבוש", "מסיבות פרטיות",

  // English adult dating interests
  "Dating", "Intimate encounters", "Casual fun", "Special friends", "Open relationships", "Experimentation",
  "New experiences", "Weekend getaways", "Passionate moments", "Spontaneous meetings", "Private parties",
  "Night adventures", "Adult entertainment", "Sensual evenings", "Learning together", "Chemistry", "Attraction"
];

// The valid values from User model schema for iAm
const VALID_IAM_VALUES = ["woman", "man", "couple"]; // Only these values are valid

const lookingForOptions = ["women", "men", "couples"]; // Only these values are valid

// More authentic Israeli adult tags
const intoTagsOptions = [
  // Hebrew options
  'מפגשים דיסקרטיים', 'חברות אינטימית', 'בילויים זוגיים', 'זוגיות פתוחה', 'קשר מזדמן',
  'סווינגרס', 'שלישיות', 'היכרויות', 'משחק קבוצתי', 'כיף וירטואלי', 'צילום אינטימי',
  'משחקי תפקידים', 'חיבור נפשי', 'אקסהיביציוניזם', 'וויארציה', 'קשר דיסקרטי',
  'טנטרה', 'עיסוי אינטימי', 'חושניות', 'רומנטיקה', 'פינוקים', 'משחקי כוח',
  'שליטה', 'כניעה', 'צעצועים', 'אביזרים', 'תחפושות', 'הקנטה', 'חיבורים חדשים',

  // English options
  'Kink', 'BDSM', 'Swinging', 'Group meetups', 'Threesomes', 'Chatting', 'Online fun',
  'Role play', 'Exhibitionism', 'Voyeurism', 'Tantra', 'Sensual massage', 'Cuddling'
];

// Israeli-style turn-ons
const turnOnsOptions = [
  // Hebrew turn-ons
  'דיבור עסיסי', 'ביטחון עצמי', 'אינטליגנציה', 'הומור', 'כריזמה', 'שפה חושנית',
  'סטייל אישי', 'נשיות', 'גבריות', 'נדיבות', 'חוש הומור', 'חוכמה', 'הקשבה',
  'גוף אתלטי', 'חיוך כובש', 'עיניים יפות', 'ידיים חזקות', 'כתפיים רחבות',
  'דומיננטיות', 'עדינות', 'הלבשה תחתונה', 'מגע עדין', 'ריח טוב', 'קעקועים',
  'ערב רומנטי', 'שמפניה', 'התכתבות חושנית', 'שיחות כנות', 'ספונטניות', 'הפתעות',

  // English turn-ons
  'Confidence', 'Intelligence', 'Humor', 'Dirty talk', 'Fit bodies', 'Chemistry',
  'Dancing', 'Good cooking', 'Spontaneity', 'Passion', 'Eye contact', 'Scent',
  'Lingerie', 'Suits', 'Tattoos', 'Piercings', 'Beards', 'Muscular', 'Curvy', 'Tall'
];

// Fixed to match User model marital status enum
const maritalStatusOptions = [
  "Single", "Married", "Divorced", "Separated", "Widowed",
  "In a relationship", "It's complicated", "Open relationship", "Polyamorous"
];

// --- Enhanced Bio Templates ---

// Hebrew bio templates for men - more suggestive/flirtatious
const hebrewMaleBioTemplates = [
  (details) => `היי! אני בן ${details.age}, ${details.maritalStatus.toLowerCase()} ומחפש הרפתקאות מיוחדות. גר ב${details.location} ואוהב ${details.interests[0] || 'מפגשים חושניים'} ו${details.interests[1] || 'קשרים אינטימיים'}. אנרגטי, מפנק ויודע מה אני רוצה. מחפש מישהי/מישהו שיודעים לקחת את הזמן וליהנות מהדרך... 😉`,

  (details) => `גבר ${details.maritalStatus.toLowerCase() || 'פנוי'} בן ${details.age} מאזור ${details.location}. אוהב ${details.interests[0] || 'לפנק'} ו${details.interests[1] || 'להיות ספונטני'}. מחפש חברות אינטימית עם כימיה טובה, בלי מחויבות אבל עם המון כבוד והדדיות. אוהב את החיים ואת הרגעים המיוחדים שהם מביאים איתם. דירה דיסקרטית ופרטיות מלאה.`,

  (details) => `בן ${details.age} מ${details.location}, מחפש מישהי שאוהבת ${details.interests[0] || 'לגלות עולמות חדשים'} כמוני. מפנק, גבוה ונראה טוב, מבין בחיים ובנשים. מחובר לגוף, לעונג ולרגשות. ${details.maritalStatus}, דיסקרטי ומחפש מישהי שיודעת מה היא רוצה בדיוק כמוני. יכול לארח במקום שקט ואלגנטי.`,

  (details) => `חם, חושני ובעל ניסיון רב. בן ${details.age}, גר ב${details.location}. ${details.maritalStatus} ומחפש קשר עם כימיה ואינטימיות חזקה, בלי סיבוכים. פתוח ל${details.interests[0] || 'חוויות חדשות'} ו${details.interests[1] || 'הרפתקאות מרגשות'}. נדיב, אסתטי, ספורטיבי ועם ראש פתוח. אם את אישה שיודעת מה היא רוצה - יש לנו על מה לדבר. 😏`,

  (details) => `ישראלי אותנטי, בן ${details.age}, חי ב${details.location}. ${details.maritalStatus || 'רווק'} שמחפש להכיר מישהי מיוחדת לבילויים משותפים ורגעים מהנים. אוהב ${details.interests[0] || 'טיולים'}, ${details.interests[1] || 'בישול'} ורגעים אינטימיים מפתיעים. דיסקרטי, מכבד ויודע לתת מקום. דירה פרטית ומעוצבת. בואי נדבר ונראה אם יש כימיה...`,
  
  (details) => `גבר בשל בן ${details.age}, 1.85, ספורטיבי ומפנק. גר ב${details.location}, ${details.maritalStatus || 'גרוש'} עם ראש צעיר וגוף שמור. מחפש מפגשים איכותיים עם אישה חושנית שאוהבת ליהנות. אוהב ${details.interests[0] || 'לפנק'} ו${details.interests[1] || 'להעניק'} במיוחד. דיסקרטיות מלאה ומקום מסודר. מבטיח שלא תתאכזבי... 🔥`,
  
  (details) => `תל אביבי אמיתי, ${details.age}, נראה טוב, ממומש עם קריירה מצליחה. חי ב${details.location}, ${details.maritalStatus || 'רווק'} ויודע מה אני מחפש. אוהב נשים בטוחות בעצמן שיודעות ליהנות מהחיים. מתחבר ל${details.interests[0] || 'חושניות'} וחוקר ${details.interests[1] || 'עולמות חדשים'}. יודע להקשיב, להרגיש ולהעניק. מבטיח חוויה בלתי נשכחת.`
];

// Hebrew bio templates for women - more suggestive/flirtatious
const hebrewFemaleBioTemplates = [
  (details) => `היי, אני בת ${details.age} מ${details.location}. אישה ${details.maritalStatus.toLowerCase() || 'פנויה'}, עצמאית ופתוחה לחוויות חדשות. אוהבת ${details.interests[0] || 'לצחוק'} ו${details.interests[1] || 'לחוות רגעים אינטימיים'}. מחפשת גבר בטוח בעצמו שיודע מה הוא רוצה ויודע גם לתת. נראית טוב, סקסית, ויודעת מה אני רוצה. האם זה אתה? 😘`,

  (details) => `בת ${details.age}, חושנית ומלאת תשוקה. גרה ב${details.location}, ${details.maritalStatus.toLowerCase() || 'רווקה'} ומחפשת קשר דיסקרטי עם כימיה חזקה. אוהבת ${details.interests[0] || 'ערבים רומנטיים'} ו${details.interests[1] || 'חוויות ספונטניות'}. גוף מעוצב, 1.70, חטובה וסקסית. מעריכה גבר שיודע לפנק ולהעניק תשומת לב. דיסקרטיות מלאה. אם אתה כזה, אשמח להכיר.`,

  (details) => `אישה מסקרנת בת ${details.age} מ${details.location}. ${details.maritalStatus || 'פנויה'}, חושנית ואוהבת את החיים. מחפשת להכיר גבר איכותי ומפנק לבילויים משותפים ורגעים מיוחדים. יודעת ליהנות מ${details.interests[0] || 'ערב טוב'} ומ${details.interests[1] || 'קשר עם כימיה חזקה'}. דיסקרטיות חשובה לי. מבטיחה חוויה מיוחדת במינה למי שיודע להעריך. מעוניין? 🔥`,

  (details) => `בת ${details.age}, נשית, מפתה ומגרה, מאזור ${details.location}. ${details.maritalStatus.toLowerCase()} ומחפשת קשר אינטימי, סוער ומהנה. חמה, רכה וחושנית. אוהבת ${details.interests[0] || 'לפנק'} ולהתפנק במיוחד. מסחררת חושים ויודעת לגרום לך לשכוח מהכל. אם אתה גבר בטוח בעצמו שיודע מה הוא רוצה, שמחפש רגעים איכותיים ללא מחויבות - כנראה שנתאים. מבטיחה לא להשאיר אותך אדיש... 😏`,

  (details) => `ישראלית אמיתית, בת ${details.age}, חיה ב${details.location}. ${details.maritalStatus || 'פנויה'} שאוהבת ליהנות מהחיים. גוף סקסי, חטוב ומפנק. מחפשת חיבור עם גבר שיודע להעריך אישה ואת הרגעים הקטנים והגדולים. אוהבת ${details.interests[0] || 'בילויים זוגיים'} ו${details.interests[1] || 'משחקים אינטימיים'}. הכימיה היא המפתח, הדיסקרטיות מובטחת והסיפוק... בטוח! 💋`,
  
  (details) => `בלונדינית סקסית בת ${details.age}, גוף חטוב ומשגע, מתגוררת ב${details.location}. ${details.maritalStatus || 'גרושה'} ומחפשת ריגושים חדשים. אוהבת ${details.interests[0] || 'מפגשים אינטימיים'} ו${details.interests[1] || 'הנאות מפתיעות'}. מתמסרת, יודעת לקחת יוזמה ולהפתיע. מחפשת גבר מנוסה, אסתטי וחושני שיודע להעריך אישה אמיתית. אפשר להגשים יחד פנטזיות... 🔥`,
  
  (details) => `תל אביבית אמיתית וסקסית בת ${details.age}. ${details.maritalStatus || 'נשואה'} שמחפשת ריגושים דיסקרטיים. מחפשת מישהו שיודע להעריך אישה בשלה ומנוסה, שמחוברת לגוף שלה ולתשוקותיה. אוהבת ${details.interests[0] || 'מפגשים סוערים'} ו${details.interests[1] || 'חוויות מעצימות'}. במיטה אני מפתיעה, חמה ומלאת תשוקה. סקרן לגלות? 💋`
];

// Hebrew bio templates for couples - more suggestive
const hebrewCoupleBioTemplates = [
  (details) => `זוג נשוי ומחובר מ${details.location}, היא בת ${details.age-2}, הוא בן ${details.age+2}. נראים טוב, ספורטיביים וצעירים ברוחנו. מחפשים להכיר זוגות/יחידים איכותיים להיכרות ואולי יותר. אוהבים ${details.interests[0] || 'בילויים משותפים'} ו${details.interests[1] || 'מפגשים דיסקרטיים'}. היא דו, הוא סטרייט, שנינו פתוחים לחוויות. כימיה והיגיינה חשובים לנו. דירה דיסקרטית במרכז. רק פניות רציניות. 🔥`,

  (details) => `זוג ${details.maritalStatus.toLowerCase()} מאזור ${details.location}. היא ${details.age-3}, חטובה ומשגעת. הוא ${details.age+2}, שרירי ומרשים. שנינו נראים טוב, פתוחים לחוויות חדשות ואוהבים לחקור. מחפשים זוגות/נשים/גברים לבילויים משותפים, ללא מחויבות אבל עם המון כיף וכימיה. אוהבים ${details.interests[0] || 'מסיבות פרטיות'} ו${details.interests[1] || 'ערבים אינטימיים'}. יכולים לארח במקום דיסקרטי ומפנק. נשמח להכיר... 😉`,

  (details) => `זוג איכותי, נשוי ופתוח מ${details.location}. שנינו נראים פצצה, אתלטיים וסקסיים. מחפשים להרחיב את המעגל החברתי שלנו עם אנשים כמונו שאוהבים את החיים ואת ההנאות שהם מציעים. אוהבים ${details.interests[0] || 'מפגשים דיסקרטיים'} ו${details.interests[1] || 'חברויות אינטימיות'}. היא ביונית, הוא סקרן. הכימיה והחיבור האישי חשובים לנו מאוד. מעוניינים במיוחד בזוגות ונשים דו. אנשים איכותיים, צרו קשר. 💋`,

  (details) => `זוג חם ואיכותי מאזור ${details.location}, היא בת ${details.age-3}, חטובה ומפתה, הוא בן ${details.age+3}, חזק ומפנק. ${details.maritalStatus} ומחפשים להכיר זוגות דומים או יחידים מעניינים. אוהבים ${details.interests[0] || 'חוויות חדשות'} ו${details.interests[1] || 'היכרויות מרגשות'}. שנינו אוהבים לפנק ולהתפנק, מלאי תשוקה ודמיון. מעוניינים במפגשים דיסקרטיים עם אנשים שיודעים מה הם רוצים. דירה דיסקרטית ומעוצבת. 🔥`,

  (details) => `זוג ישראלי אותנטי מ${details.location}, בתחילת שנות ה-${Math.floor(details.age/10)*10}. אנחנו ${details.maritalStatus.toLowerCase()}, פתוחים ואוהבים לחקור. היא מדהימה, 1.68, גוף מעוצב וסקסית בטירוף. הוא גבוה, חטוב ומנוסה. מחפשים זוגות או יחידים לבילויים משותפים ואולי יותר. לא ממהרים לשום מקום, מעדיפים להכיר לעומק ולבנות כימיה אמיתית. אוהבים ${details.interests[0] || 'ערבי גיבוש'} ו${details.interests[1] || 'מפגשים ספונטניים'}. היא אוהבת במיוחד נשים... 💋`,
  
  (details) => `זוג שובב ונועז מ${details.location}. היא ${details.age-4} בלונדינית חטובה, הוא ${details.age+1} גבוה וספורטיבי. ${details.maritalStatus} ומחפשים להכיר זוגות ויחידים לחוויות משגעות. אוהבים ${details.interests[0] || 'הרפתקאות אינטימיות'} ו${details.interests[1] || 'מסיבות פרטיות'}. מנוסים, פתוחים ואיכותיים. דירה דיסקרטית ופרטיות מובטחת. אוהבים במיוחד בחורות דו, זוגות צעירים ואנשים פתוחים לחוויות חדשות. נשמח להכיר... 🔥`,
  
  (details) => `זוג מושלם מ${details.location}, היא ${details.age-2} סקסית להחריד, הוא ${details.age+3} מרשים ודומיננטי. ${details.maritalStatus}, מנוסים ויודעים בדיוק מה אנחנו רוצים. מחפשים זוגות, בחורות דו ובחורים מרשימים לזמן איכות וחוויות סוערות. אוהבים ${details.interests[0] || 'משחקי תפקידים'} ו${details.interests[1] || 'מסיבות חושניות'}. יש לנו דירה דיסקרטית במיקום מרכזי. היגיינה, כימיה והדדיות חשובים לנו. רק רציניים שיודעים להעריך. 💋`
];

// English bio templates for men - more suggestive
const englishMaleBioTemplates = [
  (details) => `Hey there! ${details.age} year old ${details.maritalStatus.toLowerCase()} man from ${details.location}. Looking for intimate connections without complications. I love ${details.interests[0] || 'good company'} and ${details.interests[1] || 'exciting encounters'}. Athletic build, 6'1", know what I want and how to please. Can host in a discrete, elegant place. Let's talk and see where it goes... 😉`,

  (details) => `${details.maritalStatus} man, ${details.age}, living in ${details.location}. Seeking fun, passionate connections with no strings attached. I enjoy ${details.interests[0] || 'intimate evenings'} and ${details.interests[1] || 'new experiences'}. Discreet, respectful, fit and very attentive. Particularly skilled with my hands and more. If you're looking for quality time with chemistry, I'm your guy. Guaranteed satisfaction. 😏`,

  (details) => `${details.age} year old Israeli guy who knows how to have a good time. Based in ${details.location}, ${details.maritalStatus.toLowerCase()} and looking for special connections. Tall, athletic, and very well-built. I'm passionate about ${details.interests[0] || 'good wine'} and ${details.interests[1] || 'better company'}. Direct, honest, and ready to explore your deepest desires. Private apartment in central location. What are you waiting for? 🔥`,

  (details) => `Confident ${details.maritalStatus.toLowerCase()} man from ${details.location}, ${details.age} years young and full of energy. Looking for intimate friendships and passionate encounters without limitations. Athletic body, 6'0", and generous in all ways. Enjoy ${details.interests[0] || 'good conversation'} that leads to ${details.interests[1] || 'exciting chemistry'}. Discreet, clean, and ready to connect. I promise an unforgettable experience. 💪`,

  (details) => `Mature man, ${details.age}, from beautiful ${details.location}. ${details.maritalStatus} seeking special connections with like-minded adults. I value chemistry, respect, and discretion. My passions include ${details.interests[0] || 'private encounters'} and ${details.interests[1] || 'sensual moments'}. Well-established, educated, and generous. Private apartment available. Let's meet for drinks and see if we click. I'll make it worth your while... 😎`,
  
  (details) => `Sophisticated gentleman, ${details.age}, from ${details.location}. ${details.maritalStatus}. Athletic, 6'2", well-endowed, and know how to use it. Seeking passionate women for discreet, intense encounters. I love ${details.interests[0] || 'exploring fantasies'} and ${details.interests[1] || 'pushing boundaries'}. Generous, attentive, and focused on your pleasure. Can host in luxury apartment. Let me show you what you've been missing... 🔥`,
  
  (details) => `${details.maritalStatus} man, ${details.age}, living in ${details.location}. Athletic build with skilled hands and an adventurous mind. Looking for women who appreciate a man who knows what he's doing. I enjoy ${details.interests[0] || 'sensual massage'} and ${details.interests[1] || 'slow, intense encounters'}. Experienced, discrete, and attentive to your every need. Private place available. Ready to make you forget everything else? 💋`
];

// English bio templates for women - more suggestive
const englishFemaleBioTemplates = [
  (details) => `${details.age}, sensual woman from ${details.location}. ${details.maritalStatus} and looking for discreet connections. Fit, curvy in all the right places, and incredibly passionate. I love ${details.interests[0] || 'intimate evenings'} and ${details.interests[1] || 'wild encounters'}. Seeking confident men who know how to treat a woman right. I promise to exceed your expectations in every way. Chemistry is essential, discretion guaranteed. 💋`,

  (details) => `Playful and passionate woman, ${details.age}, living in ${details.location}. ${details.maritalStatus} and open to new adventures. 5'6", toned body, and insatiable appetite. Enjoy ${details.interests[0] || 'flirting'} and ${details.interests[1] || 'exploring desires'} without limits. Looking for a man who's confident, attentive, and knows what he wants. I'm wild in private and know how to please. Are you up for some mind-blowing fun? 🔥`,

  (details) => `Confident Israeli woman, ${details.age}, from ${details.location}. ${details.maritalStatus || 'Single'} and seeking special connections without complications. Stunning figure, long legs, and skills that will leave you breathless. I appreciate ${details.interests[0] || 'chemistry'} and ${details.interests[1] || 'genuine attraction'}. If you're a man who values quality over quantity, I guarantee an experience you won't forget. Let me show you what you've been missing... 😘`,

  (details) => `${details.maritalStatus} woman from ${details.location}, ${details.age} and feeling adventurous. Gorgeous curves, soft skin, and a wild side waiting to be unleashed. Looking for exciting encounters with respectful, confident men. I'm passionate about ${details.interests[0] || 'intimate connections'} and ${details.interests[1] || 'sensual experiences'} that push boundaries. Life is short - let's enjoy every moment together in ways you've only dreamed about. 😏`,

  (details) => `Feminine and sensual, ${details.age} from ${details.location}. ${details.maritalStatus} seeking special connections with men who appreciate a confident woman. Perfect body, skilled hands, and an eager mouth. I enjoy ${details.interests[0] || 'romantic evenings'} that lead to ${details.interests[1] || 'passionate nights'} of pure pleasure. No games, just genuine chemistry and mutual satisfaction that will leave you wanting more. Ready to experience heaven? 💋`,
  
  (details) => `Elegant yet wild, ${details.age}, blonde bombshell from ${details.location}. ${details.maritalStatus || 'Married'} seeking discreet adventures. 5'7", toned body, and insatiable desires. I'm skilled in ${details.interests[0] || 'the art of pleasure'} and love ${details.interests[1] || 'exploring fantasies'} without judgment. Looking for a generous man who appreciates a woman who knows exactly what she wants and how to get it. Can you handle me? 🔥`,
  
  (details) => `Stunning Israeli beauty, ${details.age}, living in ${details.location}. ${details.maritalStatus} with a body that turns heads and skills that drop jaws. Seeking select gentlemen for unforgettable encounters. I excel at ${details.interests[0] || 'intense intimacy'} and ${details.interests[1] || 'fulfilling desires'} you didn't know you had. I promise discretion, passion, and an experience beyond your wildest dreams. Are you worthy? 😘`
];

// English bio templates for couples - more suggestive
const englishCoupleBioTemplates = [
  (details) => `Adventurous couple from ${details.location}, both in our ${Math.floor(details.age/10)*10}s. She's stunning with perfect curves, he's athletic and well-endowed. ${details.maritalStatus} and looking to connect with other open-minded couples or singles. We enjoy ${details.interests[0] || 'private parties'} and ${details.interests[1] || 'intimate gatherings'} that end with a bang. She's bi-curious, he's straight, both experienced. Chemistry and discretion are essential. Let's meet and see where it leads... 🔥`,

  (details) => `Married couple in ${details.location}, she's ${details.age-2} (blonde, 5'5", incredible body), he's ${details.age+2} (tall, muscular, generous). Looking for other couples or select singles for fun and friendship, maybe more. We enjoy ${details.interests[0] || 'social encounters'} and ${details.interests[1] || 'exploring fantasies'} with the right people. She loves women, he enjoys watching and joining. Respectful, attractive, and discreet with private place. Ready to spice up your life? 💋`,

  (details) => `Experienced couple, ${details.maritalStatus.toLowerCase()}, from ${details.location}. She's a knockout redhead with curves in all the right places, he's fit and knows how to please. Looking to spice things up with like-minded adults. We're passionate about ${details.interests[0] || 'meeting new people'} and ${details.interests[1] || 'intimate connections'} that push boundaries. She's bi and loves to play, he's skilled and attentive. Clean, discreet, and ready to explore. No pressure, just intense pleasure. 😏`,

  (details) => `Attractive Israeli couple in our ${Math.floor(details.age/10)*10}s from ${details.location}. She's a petite stunner with perfect breasts, he's tall and commanding. ${details.maritalStatus} and open to new experiences with the right people. We enjoy ${details.interests[0] || 'private gatherings'} and ${details.interests[1] || 'sensual evenings'} that fulfill fantasies. Particularly interested in single women and select couples. Looking for quality connections, not quantity. Hygiene and chemistry are non-negotiable. Let's create unforgettable memories... 🔥`,

  (details) => `Fun, fit couple from ${details.location}. She's ${details.age-4} (gorgeous brunette, 34D-24-36), he's ${details.age+4} (athletic build, very well-equipped). Both attractive and open-minded. ${details.maritalStatus}, looking for couples or singles to share special moments that transcend the ordinary. We love ${details.interests[0] || 'adventurous encounters'} and ${details.interests[1] || 'exploring boundaries'} in ways that leave everyone satisfied. Can host in our private apartment. Let's meet for drinks first and see if we click. The night could end spectacularly... 💋`,
  
  (details) => `Elite couple from ${details.location}, both fitness models with perfect bodies. She's ${details.age-3}, blonde bombshell with skills that will blow your mind. He's ${details.age+2}, muscular and dominant. ${details.maritalStatus} seeking select couples and singles for extraordinary experiences. We excel at ${details.interests[0] || 'creating unforgettable memories'} and ${details.interests[1] || 'fulfilling secret desires'}. She's bi and loves women, he's experienced and generous. Luxury apartment available. Only serious inquiries from quality people. Ready for the best night of your life? 🔥`,
  
  (details) => `Sexy couple in ${details.location}, looking for adventure. She's ${details.age-2}, curves in all the right places, insatiable appetite. He's ${details.age+3}, tall, dark, and skilled beyond words. ${details.maritalStatus} and seeking playmates who appreciate the finer things in life. We love ${details.interests[0] || 'intense encounters'} and ${details.interests[1] || 'pushing boundaries'} that leave everyone breathless. Particularly interested in single women and select couples. Can host in our discrete, luxury apartment. Are you worthy of our attention? 💋`
];

// --- Enhanced photo collections with more realistic adult dating options ---
const photoCollections = {
  woman: [
    // Tasteful yet suggestive photos without showing faces - original set
    "https://images.unsplash.com/photo-1583900985737-6d0495555783?q=80&w=800", // Woman in silhouette
    "https://images.unsplash.com/photo-1512486130939-2c4f79935e4f?q=80&w=800", // Woman shadowy profile
    "https://images.unsplash.com/photo-1509967419530-da38b4704bc6?q=80&w=800", // From behind at sunset
    "https://images.unsplash.com/photo-1504276048855-f3d60e69632f?q=80&w=800", // Woman's legs only
    "https://images.unsplash.com/photo-1583900985737-6d0495555783?q=80&w=800", // Woman in dress from behind
    "https://images.unsplash.com/photo-1548911131-43cc6389d52d?q=80&w=800", // Woman on beach from behind
    "https://images.unsplash.com/photo-1542596594-649edbc13630?q=80&w=800", // Silhouette in window
    "https://images.unsplash.com/photo-1502378735452-bc7d86632805?q=80&w=800", // Woman by pool from behind
    "https://images.unsplash.com/photo-1544259197-9e7e8f16cc13?q=80&w=800", // Woman in sunlight
    "https://images.unsplash.com/photo-1489980557514-251d61e3eeb6?q=80&w=800", // Woman's silhouette
    "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?q=80&w=800", // Woman on beach at sunset
    "https://images.unsplash.com/photo-1543857778-c4a1a3e0b2eb?q=80&w=800", // Woman by window silhouette
    "https://images.unsplash.com/photo-1586807480822-0e95ba6666ad?q=80&w=800", // Woman in bedroom from behind
    "https://images.unsplash.com/photo-1594038302480-c867665379c2?q=80&w=800",  // Woman in lingerie shadow
    
    // More adult-oriented photos for women - expanded set
    "https://images.unsplash.com/photo-1588544108061-3c44c505d45d?q=80&w=800", // Woman in bed sheets
    "https://images.unsplash.com/photo-1540174401473-df5f1c06c716?q=80&w=800", // Woman in lingerie cropped
    "https://images.unsplash.com/photo-1528046279030-0bfb3d3f4de6?q=80&w=800", // Woman's silhouette in doorway
    "https://images.unsplash.com/photo-1568379783521-911c2724c33e?q=80&w=800", // Woman in hotel room
    "https://images.unsplash.com/photo-1590066233913-941dd51a2a63?q=80&w=800", // Woman silhouette by window
    "https://images.unsplash.com/photo-1586768005910-0576724ffe6b?q=80&w=800", // Woman in shower silhouette
    "https://images.unsplash.com/photo-1582639590011-f5a8416d1101?q=80&w=800", // Woman with rose petals
    "https://images.unsplash.com/photo-1575439476101-9e35d3a95186?q=80&w=800", // Woman on satin sheets
    "https://images.unsplash.com/photo-1499603732040-179b50c68549?q=80&w=800", // Woman in bathtub
    "https://images.unsplash.com/photo-1581338834647-b0fb40704e21?q=80&w=800", // Legs in stockings
    "https://images.unsplash.com/photo-1561908818-526e68ace6f8?q=80&w=800", // Woman's back in lingerie
    "https://images.unsplash.com/photo-1603766806347-54cdf3745953?q=80&w=800"  // Woman in heels from behind
  ],
  man: [
    // Tasteful yet suggestive male photos without showing faces - original set
    "https://images.unsplash.com/photo-1567013275689-c179a874478f?q=80&w=800", // Man's back muscles
    "https://images.unsplash.com/photo-1520975954732-35dd22299614?q=80&w=800", // Man in suit from behind
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=800", // Man's profile dark lighting
    "https://images.unsplash.com/photo-1485875437342-9b39470b3d95?q=80&w=800", // Man with tattoos from behind
    "https://images.unsplash.com/photo-1520975661595-6453be3f7070?q=80&w=800", // Man in formal wear silhouette
    "https://images.unsplash.com/photo-1572635196237-14b3f281503f?q=80&w=800", // Man's body only
    "https://images.unsplash.com/photo-1589571894960-20bbe2828d0a?q=80&w=800", // Man at sunset from behind
    "https://images.unsplash.com/photo-1568260437593-e69bd99ae324?q=80&w=800", // Man's silhouette
    "https://images.unsplash.com/photo-1506634572416-48cdfe530110?q=80&w=800", // Man in pool from behind
    "https://images.unsplash.com/photo-1515122616000-5badf9ded1c4?q=80&w=800", // Man in gym from behind
    "https://images.unsplash.com/photo-1586396874197-dc473d3e89bc?q=80&w=800", // Man in shadow profile
    "https://images.unsplash.com/photo-1563630423918-b58f07336ac5?q=80&w=800", // Man silhouette at window
    "https://images.unsplash.com/photo-1504257432389-52343af06ae3?q=80&w=800",  // Man shirtless from behind
    
    // More adult-oriented photos for men - expanded set
    "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?q=80&w=800", // Man in water shirtless
    "https://images.unsplash.com/photo-1534368786749-b63e05c92463?q=80&w=800", // Man's abs closeup
    "https://images.unsplash.com/photo-1570939274717-7eda259b50ed?q=80&w=800", // Man in bed sheets
    "https://images.unsplash.com/photo-1571879946812-fc9b0f28c5e6?q=80&w=800", // Man in mirror shirtless
    "https://images.unsplash.com/photo-1528454657389-9f59d6c04307?q=80&w=800", // Man with towel silhouette
    "https://images.unsplash.com/photo-1616958192292-97078e1efef4?q=80&w=800", // Man in bedroom shadow
    "https://images.unsplash.com/photo-1534359265607-b8cbe1e4d2b6?q=80&w=800", // Muscular man from behind
    "https://images.unsplash.com/photo-1624374984056-10cc8fc83ffe?q=80&w=800", // Man in boxers from behind
    "https://images.unsplash.com/photo-1580824456030-76715b515cfd?q=80&w=800", // Man in bathtub shadow
    "https://images.unsplash.com/photo-1558022013-ae0e0501a564?q=80&w=800", // Man getting out of shower
    "https://images.unsplash.com/photo-1590608897129-79da98d15969?q=80&w=800", // Man with six-pack abs
    "https://images.unsplash.com/photo-1567013127542-490d757e6aa2?q=80&w=800"  // Man's back with tattoos
  ],
  couple: [
    // Tasteful yet suggestive couple photos without showing faces - original set
    "https://images.unsplash.com/photo-1500917293891-ef795e70e1f6?q=80&w=800", // Couple embracing shadows
    "https://images.unsplash.com/photo-1518199266791-5375a83190b7?q=80&w=800", // Couple from behind sunset
    "https://images.unsplash.com/photo-1545193410-42d16995ba83?q=80&w=800", // Couple silhouette
    "https://images.unsplash.com/photo-1508214975046-380981a0fc6e?q=80&w=800", // Couple in bed from behind
    "https://images.unsplash.com/photo-1522433435688-b56f576d71e8?q=80&w=800", // Couple dancing silhouette
    "https://images.unsplash.com/photo-1474552226712-ac0f0961a954?q=80&w=800", // Couple holding hands
    "https://images.unsplash.com/photo-1463478954257-d2db1343dee3?q=80&w=800", // Couple in shadows
    "https://images.unsplash.com/photo-1526382899600-66b58e05b3e5?q=80&w=800", // Couple embracing silhouette
    "https://images.unsplash.com/photo-1595887543484-f9d27b8297be?q=80&w=800", // Couple in pool no faces
    "https://images.unsplash.com/photo-1495490311930-678c8ecb13d1?q=80&w=800", // Couple kissing silhouette
    "https://images.unsplash.com/photo-1580503029029-6104a3293b9b?q=80&w=800", // Couple in shadows intimate
    "https://images.unsplash.com/photo-1435164205788-305635a36ec2?q=80&w=800", // Couple in bed from above
    "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?q=80&w=800",  // Couple from behind beach
    
    // More adult-oriented photos for couples - expanded set
    "https://images.unsplash.com/photo-1517837543605-e89f1541d19d?q=80&w=800", // Couple in bed intimate
    "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?q=80&w=800", // Couple kissing closeup
    "https://images.unsplash.com/photo-1529369890332-8c57dadca1b0?q=80&w=800", // Couple in shower silhouette
    "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?q=80&w=800", // Couple embracing in underwear
    "https://images.unsplash.com/photo-1548089256-cfdecee379b2?q=80&w=800", // Couple intertwined in bed
    "https://images.unsplash.com/photo-1509506489701-dfe23b067808?q=80&w=800", // Couple in bath together
    "https://images.unsplash.com/photo-1520052205864-92d242b3a76b?q=80&w=800", // Couple's legs intertwined
    "https://images.unsplash.com/photo-1515962187632-65c1da999718?q=80&w=800", // Couple kissing on bed
    "https://images.unsplash.com/photo-1542056647-07114eb1e84f?q=80&w=800", // Couple in revealing clothing
    "https://images.unsplash.com/photo-1504090885647-2ca19c8c45b6?q=80&w=800", // Couple in pool intimate
    "https://images.unsplash.com/photo-1502517015259-bf5394c3df2b?q=80&w=800", // Couple intimate silhouette
    "https://images.unsplash.com/photo-1628157239582-25632655a869?q=80&w=800"  // Couple in bed sheets only
  ]
};

// Helper function for generating couple names
const generateCoupleName = () => {
  // Include both Hebrew names for couples
  const allFirstNames = [...hebrewFemaleNames, ...hebrewMaleNames];
  const name1 = getRandomElement(allFirstNames);
  let name2 = getRandomElement(allFirstNames);
  while (name1 === name2) {
    name2 = getRandomElement(allFirstNames);
  }

  // Use Hebrew connector occasionally
  const connector = Math.random() < 0.3 ? " ו" : (Math.random() < 0.5 ? " & " : " and ");
  return `${name1}${connector}${name2}`;
};

// Generate username based on name or use a cool nickname
const generateUsername = (name) => {
  // 60% chance to use a cool nickname for adult dating sites
  if (Math.random() < 0.6) {
    return getRandomElement(hebrewNicknames) + getRandomInt(1, 99);
  }

  // Otherwise derive from name
  const parts = name.toLowerCase().replace(/[^a-zא-ת0-9]/g, ' ').split(' ').filter(p => p);
  if (parts.length === 0) return `user_${getRandomInt(1000, 9999)}`;

  const base = parts.join('');
  const num = getRandomInt(0, 999);
  return num > 0 ? `${base}${num}` : base;
};

// --- Clean Database Function ---
const cleanDatabase = async () => {
  logger.warn('CLEANING DATABASE: Removing all data from collections...');
  
  // Get all collections in the database
  const collections = mongoose.connection.collections;
  
  // Drop all collections except for system collections
  for (const collectionName in collections) {
    if (!collectionName.startsWith('system.')) {
      try {
        await collections[collectionName].deleteMany({});
        logger.info(`Cleared collection: ${collectionName}`);
      } catch (err) {
        logger.error(`Error clearing collection ${collectionName}: ${err.message}`);
      }
    }
  }
  
  logger.warn('DATABASE CLEANED: All collections have been emptied.');
  
  // Re-create admin user
  const adminPassword = await bcrypt.hash('admin123', SALT_ROUNDS);
  const adminUser = new User({
    nickname: 'Admin',
    username: 'admin',
    email: ADMIN_EMAIL,
    password: 'bdkf6uv1',
    role: 'admin',
    accountTier: 'PAID',
    isVerified: true,
    active: true
  });
  
  await adminUser.save();
  logger.info(`Re-created admin user ${ADMIN_EMAIL}`);
  
  return true;
};

// --- Main Seeding Function ---
const seedDatabase = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    logger.info('MongoDB Connected for production seeding...');

    // Clean the database if requested
    if (CLEAN_DATABASE) {
      await cleanDatabase();
    }

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

    // Calculate how many more users we need to create
    let usersToCreate = 0;
    
    if (CLEAN_DATABASE) {
      usersToCreate = NUM_USERS; // Create full set after cleaning
    } else {
      if (existingUserCount < NUM_USERS) {
        usersToCreate = NUM_USERS - existingUserCount;
        
        // Clear existing seed-generated data but preserve real users
        logger.warn('Removing seed-generated data only...');
        await User.deleteMany({ 'details.seedGenerated': true });
        await Like.deleteMany({});
        await PhotoPermission.deleteMany({});
        logger.info('Seed-generated data cleared.');
      } else {
        logger.warn(`Database already has ${existingUserCount} users, which exceeds the target of ${NUM_USERS}.`);
        logger.warn('Skipping user creation but will add missing data to existing users if needed.');
      }
    }
    
    logger.info(`Will create ${usersToCreate} users.`);

    // Get existing users after possible deletion
    const existingUsers = await User.find({});
    const createdUserIds = existingUsers.map(user => user._id.toString());
    let createdUsers = [...existingUsers];
    
    // --- 1. Seed Users with Better Israeli Adult-Oriented Data ---
    if (usersToCreate > 0) {
      logger.info(`Seeding ${usersToCreate} users with realistic adult dating profiles...`);
      for (let i = 0; i < usersToCreate; i++) {
        // Decide user type first to guide other selections
        const iAm = getRandomElement(["woman", "man", "couple"]);

        // Generate appropriate name based on user type
        let nickname;
        if (iAm === 'couple') {
          nickname = generateCoupleName();
        } else if (iAm === 'woman') {
          nickname = getRandomElement(hebrewFemaleNames);
        } else { // man
          nickname = getRandomElement(hebrewMaleNames);
        }

        // Add a last name sometimes for individuals
        if (iAm !== 'couple' && Math.random() > 0.5) {
          nickname = `${nickname} `;
        }

        // Generate matching username or use a cool nickname
        const username = generateUsername(nickname);

        // Generate appropriate looking for options (using valid values only)
        let lookingFor;
        const validLookingForOptions = ["women", "men", "couples"];

        if (iAm === 'couple') {
          // Couples typically look for women, men, or other couples
          lookingFor = getRandomUniqueElements(validLookingForOptions, getRandomInt(1, 3));
        } else if (iAm === 'woman') {
          // More variety in what women might look for
          lookingFor = getRandomUniqueElements(validLookingForOptions, getRandomInt(1, 3));
        } else { // man
          // Men might look for women, couples, or less frequently men
          const preferences = Math.random() < 0.8 ?
            ['women', 'couples'] : // Most common preferences for men
            validLookingForOptions;
          lookingFor = getRandomUniqueElements(preferences, getRandomInt(1, preferences.length));
        }

        // Double-check that lookingFor only contains valid values
        lookingFor = lookingFor.filter(option => validLookingForOptions.includes(option));

        // Ensure we have at least one valid option
        if (lookingFor.length === 0) {
          lookingFor = ['women']; // Default to a common preference
        }

        // Select gender based on iAm (using only valid values)
        let gender;
        if (iAm === 'woman') {
          gender = 'female';
        } else if (iAm === 'man') {
          gender = 'male';
        } else { // couple
          gender = getRandomElement(['male', 'female']); // Represent primary account holder
        }

        // Set age ranges more realistically for adult dating
        let age;
        if (iAm === 'couple') {
          age = getRandomInt(28, 55); // Couples tend to be a bit older
        } else {
          age = getRandomInt(23, 60); // Individual age range
        }

        // Select appropriate account tier
        let accountTier;
        if (iAm === 'woman') {
          accountTier = Math.random() < 0.7 ? 'FEMALE' : getRandomElement(['FREE', 'PAID']);
        } else if (iAm === 'couple') {
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

        // Select marital status appropriate to user type (only valid values from the schema)
        let maritalStatus;
        if (iAm === 'couple') {
          // Couples are more likely to be married or in various relationship types
          maritalStatus = getRandomElement([
            'Married', 'In a relationship', 'Open relationship', 'Polyamorous'
          ]);
        } else {
          // Use only values from maritalStatusOptions which should match model's enum
          maritalStatus = getRandomElement(maritalStatusOptions);
        }

        // Double check that maritalStatus is a valid value
        const validMaritalStatuses = ["Single", "Married", "Divorced", "Separated", "Widowed",
                                     "In a relationship", "It's complicated",
                                     "Open relationship", "Polyamorous", ""];
        if (!validMaritalStatuses.includes(maritalStatus)) {
          maritalStatus = "Single"; // Fallback to a safe default
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

        // Select bio template based on user type and language preference (70% Hebrew, 30% English)
        let bioTemplate;
        const useHebrew = Math.random() < 0.7;

        if (iAm === 'man') {
          bioTemplate = useHebrew ?
            getRandomElement(hebrewMaleBioTemplates) :
            getRandomElement(englishMaleBioTemplates);
        } else if (iAm === 'woman') {
          bioTemplate = useHebrew ?
            getRandomElement(hebrewFemaleBioTemplates) :
            getRandomElement(englishFemaleBioTemplates);
        } else { // couple
          bioTemplate = useHebrew ?
            getRandomElement(hebrewCoupleBioTemplates) :
            getRandomElement(englishCoupleBioTemplates);
        }

        userDetails.bio = bioTemplate(userDetails);

        // Create the final user object
        const plainPassword = 'password123';
        const hashedPassword = await bcrypt.hash(plainPassword, SALT_ROUNDS);

        const userData = {
          nickname,
          username,
          email: `${username}@example.com`,
          password: hashedPassword,
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

      // Select appropriate photo collection based on user type
      if (userType === 'woman') photoCollection = photoCollections.woman;
      else if (userType === 'man') photoCollection = photoCollections.man;
      else if (userType === 'couple') photoCollection = photoCollections.couple;
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

      // Add additional photos (more are private for adult sites)
      for (let p = 1; p < selectedPhotos.length; p++) {
        // Higher tier accounts have more private photos
        const isPrivate = user.accountTier !== 'FREE' && Math.random() < 0.7; // More likely to be private

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

    // --- 3. Seed Likes (interactions between users) ---
    logger.info(`Seeding ${NUM_LIKES_TO_SEED} likes between users...`);
    
    if (createdUserIds.length >= 2) {
      for (let i = 0; i < NUM_LIKES_TO_SEED; i++) {
        // Get random user IDs
        let fromUserId = getRandomElement(createdUserIds);
        let toUserId = getRandomElement(createdUserIds);
        
        // Ensure we're not liking ourselves
        while (fromUserId === toUserId) {
          toUserId = getRandomElement(createdUserIds);
        }
        
        try {
          // Create like with 80% being mutual
          const isMutual = Math.random() < 0.8;
          
          const like = new Like({
            fromUser: fromUserId,
            toUser: toUserId,
            createdAt: new Date(Date.now() - getRandomInt(0, 1000 * 60 * 60 * 24 * 30)),
            status: isMutual ? 'mutual' : 'pending'
          });
          
          await like.save();
          
          // If mutual, create the reciprocal like
          if (isMutual) {
            const reciprocalLike = new Like({
              fromUser: toUserId,
              toUser: fromUserId,
              createdAt: new Date(Date.now() - getRandomInt(0, 1000 * 60 * 60 * 24 * 30)),
              status: 'mutual'
            });
            
            await reciprocalLike.save();
            i++; // Count this as another seeded like
          }
        } catch (error) {
          logger.error(`Error creating like from ${fromUserId} to ${toUserId}: ${error.message}`);
          // If it's a duplicate key error, just continue
          if (error.code !== 11000) {
            throw error;
          }
        }
      }
      
      logger.info('Likes seeded successfully');
    } else {
      logger.warn('Not enough users to seed likes. Skipping.');
    }

    // --- 4. Seed Photo Permissions ---
    logger.info(`Seeding ${NUM_PHOTO_REQUESTS_TO_SEED} photo permissions...`);
    
    if (allPrivatePhotoIdsWithOwner.length > 0 && createdUserIds.length > 1) {
      // For each permission we want to seed
      for (let i = 0; i < NUM_PHOTO_REQUESTS_TO_SEED; i++) {
        // Get a random private photo
        const randomPhotoWithOwner = getRandomElement(allPrivatePhotoIdsWithOwner);
        const ownerId = randomPhotoWithOwner.ownerId;
        const photoId = randomPhotoWithOwner.photoId;
        
        // Get a random user that isn't the owner
        let requesterId;
        do {
          requesterId = getRandomElement(createdUserIds);
        } while (requesterId === ownerId);
        
        // Determine if this permission is approved, pending, or denied
        let status;
        const randomStatus = Math.random();
        if (randomStatus < 0.7) {
          status = 'approved'; // 70% approved
        } else if (randomStatus < 0.9) {
          status = 'pending';  // 20% pending
        } else {
          status = 'denied';   // 10% denied
        }
        
        try {
          const photoPermission = new PhotoPermission({
            photo: photoId,
            owner: ownerId,
            requester: requesterId,
            status: status,
            requestDate: new Date(Date.now() - getRandomInt(0, 1000 * 60 * 60 * 24 * 14)),
            responseDate: status !== 'pending' ? 
              new Date(Date.now() - getRandomInt(0, 1000 * 60 * 60 * 24 * 7)) : 
              null
          });
          
          await photoPermission.save();
        } catch (error) {
          logger.error(`Error creating photo permission: ${error.message}`);
          // If it's a duplicate key error, just continue
          if (error.code !== 11000) {
            throw error;
          }
        }
      }
      
      logger.info('Photo permissions seeded successfully');
    } else {
      logger.warn('Not enough private photos or users to seed photo permissions. Skipping.');
    }
    
    logger.info('Database seeding completed successfully!');
    
  } catch (error) {
    logger.error('Production database seeding failed:', error);
  } finally {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected.');
  }
};

// Log info about running modes
if (CLEAN_DATABASE) {
  console.log('=================================');
  console.log('RUNNING WITH --clean OPTION: The database will be completely wiped before seeding!');
  console.log('=================================');
} else {
  console.log('=================================');
  console.log('RUNNING WITHOUT --clean OPTION: Only seed-generated data will be removed.');
  console.log('To completely clean the database, use: node seed-production.js --clean');
  console.log('=================================');
}

// Run the seeding function
seedDatabase();
