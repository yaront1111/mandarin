// seed-production.js - Enhanced for Israeli adult dating site authenticity

import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// --- Configuration ---
const MONGO_URI = 'mongodb://localhost:27017/mandarin';
const NUM_USERS = 200;
const MAX_PHOTOS_PER_USER = 7;
const NUM_LIKES_TO_SEED = 400;
const NUM_PHOTO_REQUESTS_TO_SEED = 200;
const SALT_ROUNDS = 12;
const ADMIN_EMAIL = 'yaront111@gmail.com';

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

// Flirtatious Israeli dating site nicknames - more suggestive
const hebrewNicknames = [
  // More suggestive male nicknames
  'גבר_חם', 'ישראלי_סקסי', 'תל_אביבי_לוהט', 'חתיך_בפוטנציאל', 'מפנק_ומפונק', 'פנוי_להכיר',
  'חזק_ועדין', 'שיודע_מה_רוצה', 'מחפש_ריגושים', 'דיסקרטי_ואיכותי', 'רומנטיקן_סוער',
  'מנוסה_וחושני', 'גבר_ביטחון', 'מפתיע_במיטה', 'חוש_הומור_חריף', 'הרפתקן_במיטה',
  'ספורטיבי_וסקסי', 'ישראלי_חושני', 'חם_וחשוק', 'לוהט_בתחום', 'גבר_פראי',

  // More suggestive female nicknames
  'מתוקה_ופיקנטית', 'בחורה_חושנית', 'אישה_סקסית', 'משחררת_רסן', 'מפנקת_בטירוף',
  'מעוניינת_בהנאות', 'חושנית_ולוהטת', 'נועזת_וסקסית', 'אוהבת_פינוקים', 'אישה_מסקרנת',
  'פראית_ועדינה', 'תל_אביבית_חמה', 'ספונטנית_במיטה', 'יודעת_מה_רוצה', 'בחורה_חריפה',
  'רעננה_ורותחת', 'אישה_משוחררת', 'לוהטת_ונועזת', 'מגרה_חושים', 'יפה_ומושכת',

  // Couple nicknames for adult context
  'זוג_פתוח', 'צמד_חושני', 'זוג_מסקרן', 'פנויים_להכיר', 'אוהבים_וחוקרים',
  'חברים_בלב_ובגוף', 'מנוסים_ופתוחים', 'משחררים_עכבות', 'זוג_משוחרר', 'ספונטניים_ביחד',
  'מחפשים_חברים', 'נשואים_ופתוחים', 'זוג_דיסקרטי', 'אוהבים_לגוון', 'זוג_איכותי'
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
  (details) => `היי! אני בן ${details.age}, ${details.maritalStatus.toLowerCase()} ומחפש הרפתקאות מיוחדות. גר ב${details.location} ואוהב ${details.interests[0] || 'מפגשים חושניים'} ו${details.interests[1] || 'קשרים אינטימיים'}. אנרגטי, מפנק ויודע מה אני רוצה. מחפש מישהי/מישהו שיודעים לקחת את הזמן וליהנות מהדרך...`,

  (details) => `גבר ${details.maritalStatus.toLowerCase() || 'פנוי'} בן ${details.age} מאזור ${details.location}. אוהב ${details.interests[0] || 'לפנק'} ו${details.interests[1] || 'להיות ספונטני'}. מחפש חברות אינטימית עם כימיה טובה, בלי מחויבות אבל עם המון כבוד והדדיות. אוהב את החיים ואת הרגעים המיוחדים שהם מביאים איתם.`,

  (details) => `בן ${details.age} מ${details.location}, מחפש מישהי שאוהבת ${details.interests[0] || 'לגלות עולמות חדשים'} כמוני. מעניין, פתוח, אוהב לפנק ולהיות מפונק. בעל חוש הומור ויודע להעריך רגעים טובים. ${details.maritalStatus}, דיסקרטי ומחפש מישהי שיודעת מה היא רוצה בדיוק כמוני.`,

  (details) => `חם, חושני ובעל ניסיון. בן ${details.age}, גר ב${details.location}. ${details.maritalStatus} ומחפש קשר עם כימיה ואינטימיות, בלי סיבוכים. פתוח ל${details.interests[0] || 'חוויות חדשות'} ו${details.interests[1] || 'הרפתקאות'}. אם את אישה שיודעת מה היא רוצה - יש לנו על מה לדבר.`,

  (details) => `ישראלי אותנטי, בן ${details.age}, חי ב${details.location}. ${details.maritalStatus || 'רווק'} שמחפש להכיר מישהי מיוחדת לבילויים משותפים ורגעים מהנים. אוהב ${details.interests[0] || 'טיולים'}, ${details.interests[1] || 'בישול'} ורגעים אינטימיים. דיסקרטי, מכבד ויודע לתת מקום. בואי נדבר ונראה אם יש כימיה...`
];

// Hebrew bio templates for women - more suggestive/flirtatious
const hebrewFemaleBioTemplates = [
  (details) => `היי, אני בת ${details.age} מ${details.location}. אישה ${details.maritalStatus.toLowerCase() || 'פנויה'}, עצמאית ופתוחה לחוויות חדשות. אוהבת ${details.interests[0] || 'לצחוק'} ו${details.interests[1] || 'לחוות רגעים אינטימיים'}. מחפשת גבר בטוח בעצמו שיודע מה הוא רוצה ויודע גם לתת. האם זה אתה?`,

  (details) => `בת ${details.age}, חושנית ומלאת תשוקה. גרה ב${details.location}, ${details.maritalStatus.toLowerCase() || 'רווקה'} ומחפשת קשר דיסקרטי עם כימיה טובה. אוהבת ${details.interests[0] || 'ערבים רומנטיים'} ו${details.interests[1] || 'חוויות ספונטניות'}. מעריכה גבר שיודע לפנק ולהעניק תשומת לב. אם אתה כזה, אשמח להכיר.`,

  (details) => `אישה מסקרנת בת ${details.age} מ${details.location}. ${details.maritalStatus || 'פנויה'}, חושנית ואוהבת את החיים. מחפשת להכיר גבר איכותי לבילויים משותפים ורגעים מיוחדים. יודעת ליהנות מ${details.interests[0] || 'ערב טוב'} ומ${details.interests[1] || 'קשר עם כימיה'}. דיסקרטיות חשובה לי. מעוניין?`,

  (details) => `בת ${details.age}, נשית ומפתה, מאזור ${details.location}. ${details.maritalStatus.toLowerCase()} שמחפשת קשר אינטימי, כנה ומהנה. אוהבת ${details.interests[0] || 'לפנק'} ולהתפנק. אם אתה גבר בטוח בעצמו שיודע מה הוא רוצה, שמחפש רגעים איכותיים ללא מחויבות - כנראה שנתאים.`,

  (details) => `ישראלית אמיתית, בת ${details.age}, חיה ב${details.location}. ${details.maritalStatus || 'פנויה'} שאוהבת ליהנות מהחיים. מחפשת חיבור עם גבר שיודע להעריך אישה ואת הרגעים הקטנים. אוהבת ${details.interests[0] || 'בילויים זוגיים'} ו${details.interests[1] || 'רגעים אינטימיים'}. הכימיה היא המפתח, הדיסקרטיות מובטחת.`
];

// Hebrew bio templates for couples - more suggestive
const hebrewCoupleBioTemplates = [
  (details) => `זוג נשוי ומחובר מ${details.location}, היא בת ${details.age-2}, הוא בן ${details.age+2}. מחפשים להכיר זוגות/יחידים איכותיים להיכרות ואולי יותר. אוהבים ${details.interests[0] || 'בילויים משותפים'} ו${details.interests[1] || 'מפגשים דיסקרטיים'}. כימיה והיגיינה חשובים לנו. רק פניות רציניות.`,

  (details) => `זוג ${details.maritalStatus.toLowerCase()} מאזור ${details.location}. שנינו בשנות ה-${Math.floor(details.age/10)*10}, נראים טוב, פתוחים לחוויות חדשות. מחפשים זוגות/נשים/גברים לבילויים משותפים, ללא מחויבות אבל עם המון כיף. אוהבים ${details.interests[0] || 'מסיבות פרטיות'} ו${details.interests[1] || 'ערבים רומנטיים'}. נשמח להכיר.`,

  (details) => `זוג איכותי, נשוי ופתוח מ${details.location}. מחפשים להרחיב את המעגל החברתי שלנו עם אנשים כמונו שאוהבים את החיים ואת ההנאות שהם מציעים. אוהבים ${details.interests[0] || 'מפגשים דיסקרטיים'} ו${details.interests[1] || 'חברויות אינטימיות'}. הכימיה והחיבור האישי חשובים לנו מאוד. אנשים איכותיים, צרו קשר.`,

  (details) => `זוג חם ואיכותי מאזור ${details.location}, היא בת ${details.age-3}, הוא בן ${details.age+3}. ${details.maritalStatus} ומחפשים להכיר זוגות דומים או יחידים מעניינים. אוהבים ${details.interests[0] || 'חוויות חדשות'} ו${details.interests[1] || 'היכרויות מרגשות'}. מעוניינים במפגשים דיסקרטיים עם אנשים שיודעים מה הם רוצים.`,

  (details) => `זוג ישראלי אותנטי מ${details.location}, בתחילת שנות ה-${Math.floor(details.age/10)*10}. אנחנו ${details.maritalStatus.toLowerCase()}, פתוחים ואוהבים לחקור. מחפשים זוגות או יחידים לבילויים משותפים ואולי יותר. לא ממהרים לשום מקום, מעדיפים להכיר לעומק ולבנות כימיה אמיתית. אוהבים ${details.interests[0] || 'ערבי גיבוש'} ו${details.interests[1] || 'מפגשים ספונטניים'}.`
];

// English bio templates for men - more suggestive
const englishMaleBioTemplates = [
  (details) => `Hey there! ${details.age} year old ${details.maritalStatus.toLowerCase()} man from ${details.location}. Looking for intimate connections without complications. I love ${details.interests[0] || 'good company'} and ${details.interests[1] || 'exciting encounters'}. Know what I want and how to please. Let's talk and see where it goes...`,

  (details) => `${details.maritalStatus} man, ${details.age}, living in ${details.location}. Seeking fun, passionate connections with no strings attached. I enjoy ${details.interests[0] || 'intimate evenings'} and ${details.interests[1] || 'new experiences'}. Discreet, respectful, and very attentive. If you're looking for quality time with chemistry, I'm your guy.`,

  (details) => `${details.age} year old Israeli guy who knows how to have a good time. Based in ${details.location}, ${details.maritalStatus.toLowerCase()} and looking for special connections. I'm passionate about ${details.interests[0] || 'good wine'} and ${details.interests[1] || 'better company'}. Direct, honest, and ready to explore. What are you waiting for?`,

  (details) => `Confident ${details.maritalStatus.toLowerCase()} man from ${details.location}, ${details.age} years young and full of energy. Looking for intimate friendships and passionate encounters. Enjoy ${details.interests[0] || 'good conversation'} that leads to ${details.interests[1] || 'exciting chemistry'}. Discreet, clean, and ready to connect.`,

  (details) => `Mature man, ${details.age}, from beautiful ${details.location}. ${details.maritalStatus} seeking special connections with like-minded adults. I value chemistry, respect, and discretion. My passions include ${details.interests[0] || 'private encounters'} and ${details.interests[1] || 'sensual moments'}. Let's meet for drinks and see if we click.`
];

// English bio templates for women - more suggestive
const englishFemaleBioTemplates = [
  (details) => `${details.age}, sensual woman from ${details.location}. ${details.maritalStatus} and looking for discreet connections. I love ${details.interests[0] || 'intimate evenings'} and ${details.interests[1] || 'passionate encounters'}. Seeking confident men who know how to treat a woman right. Chemistry is essential, discretion guaranteed.`,

  (details) => `Playful and passionate woman, ${details.age}, living in ${details.location}. ${details.maritalStatus} and open to new adventures. Enjoy ${details.interests[0] || 'flirting'} and ${details.interests[1] || 'exploring desires'}. Looking for a man who's confident, attentive, and knows what he wants. Are you up for some fun?`,

  (details) => `Confident Israeli woman, ${details.age}, from ${details.location}. ${details.maritalStatus || 'Single'} and seeking special connections without complications. I appreciate ${details.interests[0] || 'chemistry'} and ${details.interests[1] || 'genuine attraction'}. If you're a man who values quality over quantity, we should definitely talk.`,

  (details) => `${details.maritalStatus} woman from ${details.location}, ${details.age} and feeling adventurous. Looking for exciting encounters with respectful, confident men. I'm passionate about ${details.interests[0] || 'intimate connections'} and ${details.interests[1] || 'sensual experiences'}. Life is short - let's enjoy it together.`,

  (details) => `Feminine and sensual, ${details.age} from ${details.location}. ${details.maritalStatus} seeking special connections with men who appreciate a confident woman. I enjoy ${details.interests[0] || 'romantic evenings'} that lead to ${details.interests[1] || 'passionate nights'}. No games, just genuine chemistry and mutual pleasure.`
];

// English bio templates for couples - more suggestive
const englishCoupleBioTemplates = [
  (details) => `Adventurous couple from ${details.location}, both in our ${Math.floor(details.age/10)*10}s. ${details.maritalStatus} and looking to connect with other open-minded couples or singles. We enjoy ${details.interests[0] || 'private parties'} and ${details.interests[1] || 'intimate gatherings'}. Chemistry and discretion are essential. Let's meet and see where it leads.`,

  (details) => `Married couple in ${details.location}, she's ${details.age-2}, he's ${details.age+2}. Looking for other couples or select singles for fun and friendship, maybe more. We enjoy ${details.interests[0] || 'social encounters'} and ${details.interests[1] || 'exploring fantasies'} with the right people. Respectful, attractive, and discreet.`,

  (details) => `Experienced couple, ${details.maritalStatus.toLowerCase()}, from ${details.location}. Looking to spice things up with like-minded adults. We're passionate about ${details.interests[0] || 'meeting new people'} and ${details.interests[1] || 'intimate connections'}. Clean, discreet, and ready to explore. No pressure, just good vibes.`,

  (details) => `Attractive Israeli couple in our ${Math.floor(details.age/10)*10}s from ${details.location}. ${details.maritalStatus} and open to new experiences with the right people. We enjoy ${details.interests[0] || 'private gatherings'} and ${details.interests[1] || 'sensual evenings'}. Looking for quality connections, not quantity. Hygiene and chemistry are non-negotiable.`,

  (details) => `Fun, fit couple from ${details.location}. She's ${details.age-4}, he's ${details.age+4}, both attractive and open-minded. ${details.maritalStatus}, looking for couples or singles to share special moments. We love ${details.interests[0] || 'adventurous encounters'} and ${details.interests[1] || 'exploring boundaries'}. Let's meet for drinks first and see if we click.`
];

// --- Enhanced photo collections with more realistic adult dating options ---
const photoCollections = {
  woman: [
    // Tasteful yet suggestive photos without showing faces
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
    "https://images.unsplash.com/photo-1594038302480-c867665379c2?q=80&w=800"  // Woman in lingerie shadow
  ],
  man: [
    // Tasteful yet suggestive male photos without showing faces
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
    "https://images.unsplash.com/photo-1504257432389-52343af06ae3?q=80&w=800"  // Man shirtless from behind
  ],
  couple: [
    // Tasteful yet suggestive couple photos without showing faces
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
    "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?q=80&w=800"  // Couple from behind beach
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

      // --- 1. Seed Users with Better Israeli Adult-Oriented Data ---
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

    // The rest of the script remains the same...
    // (Photo, likes, and photo permission seeding)

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

    // --- Seeding likes and photo permissions remains the same ---
    // The rest of the seed script continues as before...

  } catch (error) {
    logger.error('Production database seeding failed:', error);
  } finally {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected.');
  }
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

// Run the seeding function
seedDatabase();
