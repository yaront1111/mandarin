// seed-production.js - Enhanced for Israeli adult dating site focused on one-night stands

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
  'מיקה', 'אביגיל', 'ענבר', 'נטע', 'אילה', 'שירלי', 'לירון', 'דניאל', 'נופר', 'גלי',
  'שרון', 'אור', 'ניקול', 'אורטל', 'סיון', 'סיגל', 'ליטל', 'לימור', 'מירי', 'ספיר'
];

// Hebrew male names - keeping authentic
const hebrewMaleNames = [
  'איתי', 'יובל', 'עומר', 'אמיר', 'אורי', 'רועי', 'נועם', 'יונתן', 'אלון', 'דניאל',
  'אייל', 'אסף', 'עידו', 'גיא', 'נדב', 'תומר', 'עמית', 'ניר', 'אלעד', 'רון',
  'דור', 'יואב', 'טל', 'שחר', 'עידן', 'אופיר', 'מתן', 'אריאל', 'יאיר', 'עמרי',
  'ליאור', 'אבי', 'ינאי', 'קובי', 'משה', 'דוד', 'ירון', 'בן', 'יוסי', 'גל'
];

// Explicit one-night stand focused nicknames with Hebrew
const hebrewNicknames = [
  // More explicit male nicknames
  'גבר_לוהט', 'בודד_הלילה', 'מפתיע_במיטה', 'רק_לערב', 'אדון_בחדר', 'כוס_תה_בוקר',
  'מחפש_ללילה', 'בשביל_הכיף', 'מזיין_מקצועי', 'בעל_ניסיון', 'לוהט_בלילות', 'סקס_ידיד',
  'דיסקרטי_בתא', 'גבר_עם_חדר', 'בלי_מחויבות', 'לפגישה_חד', 'בא_והולך', 'מזיין_טוב',
  'בלי_מחר', 'פגישה_חמה', 'נשוי_משועמם', 'ללילה_בלבד', 'בן_זונה_טוב', 'כניסה_מיידית',
  'לפינוק_מהיר', 'חם_ומהיר', 'מחפש_עכשיו', 'לוהט_24_7', 'דפוק_טוב', 'כוס_קפה_ומזיון',
  'פגישת_סקס', 'חד_פעמי', 'בלי_סנטימנטים', 'מהיר_ועצבני', 'חובב_בוקר_מהיר', 'חוץ_נשואין',
  'בן40_מנוסה', 'מחפש_בחורה_בדירה', 'גבר_זין_גדול', 'סקס_ראשון_פגישה', 'לא_לקשר',

  // More explicit female nicknames
  'רטובה_הלילה', 'פטמות_קשות', 'מחפשת_זין', 'צמאה_לסקס', 'נימפו_תל_אביבית', 'חרמנית_בודדה',
  'צעירה_בת22', 'נשואה_בודדה', 'רוצה_אותך_עכשיו', 'רק_ללילה', 'חד_פעמית', 'סקס_פרוע',
  'חמה_ורטובה', 'נמרה_במיטה', 'בוגרת_חרמנית', 'זיון_מהיר', 'לוהטת_לערב', 'בלי_ציפיות',
  'פה_עמוק', 'בת30_זקוקה', 'בחדר_המלון', 'חסרת_מעצורים', 'רוכבת_מקצועית', 'בלונדה_לוהטת',
  'מחרמנת_גברים', 'רופאה_מיוחדת', 'אוהבת_מאחורה', 'גרושה_צעירה', 'שדיים_גדולים', 'תחת_שמן',
  'מיוחדת_במיטה', 'ללילה_אחד', 'זקוקה_עכשיו', 'בת35_מנוסה', 'ללא_מעצורים', 'סקסית_חסרת_ניסיון',
  'לזיון_מהיר', 'אמא_שרוצה', 'אוהבת_שליטה', 'מתמסרת_לגמרי', 'לבלות_ולגמור',

  // Couple nicknames for one-night stands
  'זוג_ללילה', 'שלושה_ביחד', 'זוג_מחפש_שלישי', 'מחפשים_לעכשיו', 'זוג_חרמנים',
  'היא_רוצה_שניים', 'הוא_צופה_היא_נהנית', 'זוג_לזיון_מהיר', 'פגישה_חמה_לערב', 'מחפשים_לחדר',
  'סקס_קבוצתי_הערב', 'זוג_ראשון_פעם', 'פתוחים_לחוויה', 'בלי_רגשות', 'לפגישה_סקסית',
  'זוג_דירה_דיסקרטית', 'בלי_דיבורים_מיותרים', 'רק_גופות_לוהטים', 'חרמנים_מאוד', 'היא_אוהבת_נשים',
  'זוג_מחפש_בת_לוהטת', 'זוג40_לבחורה_צעירה', 'מחפשים_ללילה', 'הוא_דו_היא_בי', 'מחליפים_זוגות',
  'החלפת_זוגות_הערב', 'מסיבת_זיון', 'ללילה_בלבד', 'סווינגרס_מנוסים', 'זוג_במלון_הערב',
  'מחפשים_אמיתיים', 'זוג_נשוי_מזמין', 'מפגש_לוהט_בדירתנו', 'זיון_מהיר_עכשיו', 'מחפשים_להיום'
];

// Israeli locations with Hebrew
const locations = [
  'תל אביב', 'תל אביב צפון', 'רמת אביב', 'פלורנטין', 'רוטשילד', 'הרצליה פיתוח', 'רמת השרון',
  'רעננה', 'כפר סבא', 'נתניה', 'ראשון לציון', 'אשדוד', 'אשקלון', 'מודיעין', 'ירושלים',
  'חיפה', 'קריות', 'באר שבע', 'אילת', 'הוד השרון', 'פתח תקווה', 'רמת גן', 'בת ים',
  'גבעתיים', 'לוד', 'רחובות', 'רמלה', 'אור יהודה', 'יפו', 'רמת הגולן', 'זכרון יעקב',
  'עיר הכרמל', 'קיסריה', 'סביון', 'ארסוף', 'בית ינאי', 'הוד השרון', 'גני תקווה', 'שוהם'
];

// One-night stand focused interests with Hebrew options
const interestsBank = [
  // Hebrew explicit interests
  "סקס מהיר", "פגישות לילה", "זיונים ספונטניים", "מפגשים דיסקרטיים", "מלון לשעה", "ללא מחויבות",
  "סקס אנאלי", "סקס אוראלי", "משחקי תפקידים", "חוויה ראשונה", "דירה דיסקרטית", "סקס בטלפון",
  "צילום עצמי", "מסג' אירוטי", "חילופי זוגות", "אורגיות", "בחורה נוספת", "גבר נוסף",
  "צעצועים מיניים", "פטישים", "בגדי עור", "כבילה", "משחקי שליטה", "רולפליי", "אוטואירוטיקה",

  // Hebrew casual activities
  "לילות לוהטים", "שתייה ובילוי", "מסיבות פרטיות", "מועדונים", "בריכה פרטית", "ג׳קוזי", "סאונה",
  "ערבי גיבוש", "חוף נודיסטים", "קוקטיילים", "וויסקי טוב", "מסג' הדדי", "חופשות ספונטניות",
  "בילוי לילי", "ימי כיף", "חיי לילה", "פינוקי גוף", "שמפנייה וסקס", "לילה חם במלון",

  // English adult interests
  "One-night stands", "No strings attached", "Casual hookups", "Quick sex", "Hotel fun", "Car sex",
  "Morning after", "Party hookups", "Anonymous encounters", "Discrete meets", "Late night calls",
  "Sexting", "Video calls", "Shower sex", "Beach adventures", "Drunk fun", "Spontaneous sex",
  "Club encounters", "After-party fun", "First date sex", "Outdoor adventures", "Threesomes",
  "Swinging", "Group play", "BDSM", "Domination", "Submission", "Rough play", "Sex toys"
];

// The valid values from User model schema for iAm
const VALID_IAM_VALUES = ["woman", "man", "couple"]; // Only these values are valid

const lookingForOptions = ["women", "men", "couples"]; // Only these values are valid

// More explicit one-night stand focused tags
const intoTagsOptions = [
  // Hebrew explicit tags
  'סקס חד פעמי', 'זיון מהיר', 'ללא מחויבות', 'הצעות אינטימיות', 'מפגשים מהירים', 'סקס בדירתי',
  'זיונים ספונטניים', 'לילה אחד לוהט', 'אורגיות', 'סווינגרס', 'שלישיות', 'גבר לזוג',
  'אישה לזוג', 'כל חור אפשרי', 'אנאלי', 'אוראלי מעמיק', 'בליעה', 'גמירות חזקות',
  'גמירה בפנים', 'גמירה בפה', 'גמירה על פנים', 'גמירה על גוף', 'סאדו מאזו', 'כבילה',
  'משחקי שליטה', 'כניעה', 'השפלה', 'צעצועים', 'רטט', 'רולפליי', 'חוויה רב חושית',

  // English explicit tags
  'One-night stands', 'NSA fun', 'Quickies', 'Car sex', 'Hotel meetings', 'Morning sex',
  'Drunk sex', 'Party hookups', 'Shower sex', 'Threesomes', 'Group sex', 'Orgies',
  'DVP', 'DP', 'Gangbang', 'Bukkake', 'Creampie', 'Facials', 'Deepthroat', 'BBC',
  'Cuckold', 'Hotwife', 'Public sex', 'Anonymous', 'First timers', 'Virgins', 'Cheating',
  'Swingers', 'Glory holes', 'Dogging', 'Fetish', 'Extreme', 'Kink', 'Domination'
];

// Explicit one-night stand turn-ons
const turnOnsOptions = [
  // Hebrew turn-ons
  'זין גדול', 'כוס רטוב', 'חזה גדול', 'תחת גדול', 'גוף חטוב', 'שרירי', 'שזוף',
  'מקועקע', 'פירסינג', 'בלונדינית', 'מילפית', 'צעירים', 'מבוגרים', 'סקס אלים',
  'דיבור מלוכלך', 'מצלמים', 'תחתונים סקסיים', 'גרביונים', 'עקבים', 'מדים', 'ללא תחתונים',
  'התפשטות', 'ריקוד מיני', 'חשפנית', 'זיון עם זרים', 'מקומות ציבוריים', 'בריכה', 'ריח של גבר',
  'ריח של אישה', 'טעם של כוס', 'טעם של זרע', 'קולות של אישה', 'אנחות', 'צעקות',

  // English turn-ons
  'Big dick', 'Wet pussy', 'Big tits', 'Big ass', 'Hard cock', 'Deep throat', 'Squirting',
  'Multiple orgasms', 'No condom', 'Risky sex', 'Creampie', 'Facial', 'Swallowing',
  'Anal sex', 'Double penetration', 'Dirty talk', 'Spanking', 'Hair pulling', 'Choking',
  'Rough sex', 'Dominance', 'Submission', 'Bondage', 'Threesomes', 'Group sex', 'Exhibitionism',
  'Voyeurism', 'Public sex', 'Car sex', 'Office sex', 'Beach sex', 'Hotel rooms', 'Quickies',
  'First date sex', 'Anonymous sex', 'Drunk hookups', 'Morning sex', 'Sexting', 'Nudes'
];

// Fixed to match User model marital status enum
const maritalStatusOptions = [
  "Single", "Married", "Divorced", "Separated", "Widowed",
  "In a relationship", "It's complicated", "Open relationship", "Polyamorous"
];

// --- Enhanced Bio Templates for One-Night Stands ---

// Hebrew explicit bio templates for men
const hebrewMaleBioTemplates = [
  (details) => `אני פה בשביל זיון טוב. בן ${details.age}, ${details.maritalStatus.toLowerCase()} וחרמן. גר ב${details.location} עם דירה דיסקרטית. אוהב ${details.interests[0] || 'סקס אנאלי'} ו${details.interests[1] || 'מציצות עמוקות'}. מחפש אישה/זוג שרוצים פגישה חד פעמית או קבועה לסקס בלבד. בלי כאבי ראש, בלי דרמות, רק סקס טוב.`,

  (details) => `בן ${details.age} מחפש לזיין הלילה. נמצא ב${details.location}, ${details.maritalStatus.toLowerCase() || 'פנוי'} ויכול לארח. מחפש מפגש ספונטני עם אישה חרמנית או זוג פתוח. חשוב לי שיהיה כימיה טובה, היגיינה וסקס טוב. יש לי ${details.interests[0] || 'ניסיון עם זוגות'} וגם ${details.interests[1] || 'אוהב לפנק נשים'}. שולח תמונה למי שרצינית.`,

  (details) => `גבר בן ${details.age} מחפש אישה/זוג לזיון מהיר הערב. נראה טוב, נקי, מפנק ויודע מה אני עושה. גר ב${details.location} ויכול לארח או להגיע. ${details.maritalStatus}, דיסקרטי, עם ניסיון ב${details.interests[0] || 'סקס אנאלי'} ו${details.interests[1] || 'משחקי תפקידים'}. מבטיח ערב שלא תשכחי. בלי מחויבות, רק הנאה הדדית.`,

  (details) => `בן ${details.age}, זין גדול וקשה הערב למי שרוצה. מחפש מישהי חרמנית, רטובה ומוכנה לקבל. גר ב${details.location}, ${details.maritalStatus.toLowerCase() || 'נשוי'} ומחפש דיסקרטיות. אוהב ${details.interests[0] || 'מציצות עמוקות'}, ${details.interests[1] || 'סקס אנאלי'} וגמירות חזקות. משלם למלון במקרה הצורך. את מוכנה? אני מוכן.`,

  (details) => `רק בשביל הלילה - בן ${details.age} מ${details.location} מחפש סקס טוב בלי שאלות וציפיות. ${details.maritalStatus || 'נשוי'} ודיסקרטי, יכול לארח בדירה נקייה או להגיע אלייך. מבטיח ${details.interests[0] || 'זיון חזק'}, ${details.interests[1] || 'גמירות מרובות'} וסיפוק מלא. אם את מחפשת להיפגש הערב, לקבל זין טוב ולהמשיך הלאה - אני הגבר שלך.`
];

// Hebrew explicit bio templates for women
const hebrewFemaleBioTemplates = [
  (details) => `בת ${details.age}, חרמנית לגמרי וצריכה זין הערב. גרה ב${details.location}, ${details.maritalStatus.toLowerCase() || 'רווקה'} ומחפשת גבר שיודע לזיין טוב. אוהבת ${details.interests[0] || 'סקס חזק'} ו${details.interests[1] || 'שיגמרו לי בפה'}. אני מארחת בדירה שקטה ונקייה. ללא מחוייבות, ללא שאלות מיותרות, רק סקס טוב. שעה טובה וביי.`,

  (details) => `חרמנית בת ${details.age} רוצה זין טוב הלילה. גרה ב${details.location}, ${details.maritalStatus.toLowerCase() || 'גרושה'} ומחפשת רק גברים חרמנים, עם זין גדול ויכולת לספק אותי. אוהבת ${details.interests[0] || 'מציצות'} ו${details.interests[1] || 'שמזיינים אותי מאחורה'}. יש לי דירה דיסקרטית. לא משלמת ולא מקבלת תשלום, רק סקס הדדי ומספק. מתאים לך?`,

  (details) => `אישה בת ${details.age} מ${details.location} מחפשת לילה חם. ${details.maritalStatus || 'נשואה'} ולכן דיסקרטיות חשובה מאוד. מחפשת מישהו שיכול לארח, שנראה טוב, שיודע לזיין ושלא ישאל יותר מדי שאלות. אוהבת ${details.interests[0] || 'סקס אוראלי'} ו${details.interests[1] || 'שמזיינים אותי חזק'}. לא מעוניינת בקשר או מחויבות, רק בפגישה חד פעמית או לפעמים.`,

  (details) => `בת ${details.age}, רטובה וחרמנית הלילה. גרה ב${details.location}, ${details.maritalStatus.toLowerCase() || 'בזוגיות פתוחה'} ומחפשת גבר לפגישה מיידית. אוהבת ${details.interests[0] || 'שמזיינים אותי חזק'} ו${details.interests[1] || 'שגומרים לי על הפנים'}. יכולה להגיע אליך או שתגיע אלי, בלי יותר מדי דיבורים. מחפשת רק גברים שנראים טוב, עם גוף ספורטיבי וזין טוב. אם אתה רעב כמוני, נדבר.`,

  (details) => `אישה בת ${details.age} מ${details.location} מחפשת זיון איכותי הערב. ${details.maritalStatus || 'גרושה'} ומחפשת להשתחרר. אוהבת ${details.interests[0] || 'זיונים ספונטניים'} ו${details.interests[1] || 'גמירות חזקות'}, בלי התחייבויות, בלי שאלות, רק חווית סקס טובה. אם אתה גבר נאה, נקי, דיסקרטי ויודע מה אתה עושה במיטה - תשלח הודעה. אני לא משאירה פרטים, לא מקבלת מספרי טלפון, רק פגישה להיום וזהו.`
];

// Hebrew explicit bio templates for couples
const hebrewCoupleBioTemplates = [
  (details) => `זוג חרמן, היא בת ${details.age-2}, הוא בן ${details.age+2}. גרים ב${details.location} ומחפשים פרטנרים לסקס הערב. היא אוהבת ${details.interests[0] || 'שני גברים'}, הוא אוהב ${details.interests[1] || 'לראות אותה מקבלת'}. מארחים בדירה דיסקרטית, נקייה ונעימה. מחפשים אנשים נאים, נקיים וחרמנים לערב אחד של הנאה ללא גבולות. דיסקרטיות מלאה מובטחת.`,

  (details) => `זוג ${details.maritalStatus.toLowerCase() || 'נשוי'} מחפש שלישייה הלילה. היא בת ${details.age-3}, יפה ובי, הוא בן ${details.age+3}, חתיך וסטרייט. גרים ב${details.location} ומארחים. מחפשים אישה יפה או גבר נאה להצטרף לערב אחד של תענוגות. אנחנו אוהבים ${details.interests[0] || 'סקס אוראלי'}, ${details.interests[1] || 'שלישיות'} וניסיונות חדשים. נקיים, אסתטיים ודיסקרטיים, מצפים לאותו דבר ממך. פגישה קצרה להיכרות בבר ומשם למיטה.`,

  (details) => `זוג לוהט, מאזור ${details.location}, שנינו בשנות ה-${Math.floor(details.age/10)*10}, נראים ממש טוב, גופות מטופחים, מנוסים בחילופי זוגות וסקס קבוצתי. מחפשים גבר/אישה/זוג לפגישה הערב. אוהבים ${details.interests[0] || 'אורגיות'}, ${details.interests[1] || 'סווינגרס'} ופתוחים להכל. דיסקרטיות מלאה, מקום, הכל נקי ומסודר. רק מי שבאמת רוצה ויכול הערב.`,

  (details) => `זוג חם מ${details.location} מחפש לזיין הערב. היא בת ${details.age-4}, בלונדינית עם ציצים גדולים, הוא בן ${details.age+4}, שרירי עם זין גדול. אנחנו ${details.maritalStatus.toLowerCase() || 'בזוגיות פתוחה'} ומחפשים בחורה/בחור/זוג למפגש פתוח, בלי גבולות, בלי עכבות, רק סקס טוב. אוהבים ${details.interests[0] || 'אנאלי'}, ${details.interests[1] || 'ביסקסואליות'} ופתוחים לניסיונות חדשים. מארחים במקום דיסקרטי ונעים. שלחו הודעה אם אתם רציניים.`,

  (details) => `זוג בני ${details.age} מחפשים מישהי/מישהו/זוג לסקס הלילה. אנחנו נראים טוב, נקיים, דיסקרטיים ומאוד חרמנים. יש לנו דירה ב${details.location}, אלכוהול טוב, מצב רוח מעולה וחשק חזק. אנחנו אוהבים ${details.interests[0] || 'סקס קבוצתי'}, ${details.interests[1] || 'צילומים אינטימיים'} וקינקים שונים. לא צריך מחויבות, לא צריך קשר לאחר מכן, רק ערב מושלם של הנאה הדדית ומשם כל אחד לדרכו.`
];

// English explicit bio templates for men
const englishMaleBioTemplates = [
  (details) => `${details.age} year old male looking for sex tonight. I'm in ${details.location}, ${details.maritalStatus.toLowerCase() || 'single'} and very horny. I have my own place, can host or travel. I love ${details.interests[0] || 'oral'} and ${details.interests[1] || 'anal'}. Looking for women/couples who want no-strings-attached fun. Clean, respectful, and know what I'm doing. Big dick ready for action. Message if you want to cum tonight.`,

  (details) => `Horny ${details.maritalStatus.toLowerCase() || 'married'} man from ${details.location}, ${details.age} years old. Looking for discreet encounters, one-night stands only. I enjoy ${details.interests[0] || 'rough sex'} and ${details.interests[1] || 'multiple orgasms'}. Can host at my private apartment or meet at a hotel. No drama, no commitment, just hot sex. I'm well-endowed, fit, and know how to please. Available tonight - are you?`,

  (details) => `${details.age}M from ${details.location} ready to fuck now. ${details.maritalStatus} looking for NSA sex with hot women or couples. I'm fit, clean, and know how to use my thick 8" cock. Into ${details.interests[0] || 'deep throat'} and ${details.interests[1] || 'hard fucking'}. Can host in my private apartment. No games, no lengthy chats, just meet and fuck. Send pics if serious.`,

  (details) => `Experienced ${details.maritalStatus.toLowerCase()} man, ${details.age}, from ${details.location}. Looking for quick sex tonight with no questions asked. I enjoy ${details.interests[0] || 'eating pussy'} and ${details.interests[1] || 'anal play'}. Very discreet, can host or travel to you. I'm fit, well-hung, and can go multiple rounds. If you're looking for a one-time fling or regular hookups with no strings, message me now.`,

  (details) => `Hot male, ${details.age}, in ${details.location} ready for action tonight. ${details.maritalStatus || 'In an open relationship'} seeking discreet encounters. I excel at ${details.interests[0] || 'making you cum'} and ${details.interests[1] || 'rough sex'}. Clean, tested, and respectful but dominant in bed. Looking for women or couples who want to get fucked properly with no strings attached. Hotel or your place. Let's stop chatting and start fucking.`
];

// English explicit bio templates for women
const englishFemaleBioTemplates = [
  (details) => `${details.age}F in ${details.location} looking for cock tonight. ${details.maritalStatus.toLowerCase() || 'Single'} and extremely horny. I need a man who knows how to fuck and can make me cum multiple times. Love ${details.interests[0] || 'rough sex'} and ${details.interests[1] || 'getting my pussy eaten'}. I can host at my place. No relationship, no complications, just hot sex and goodbye. Are you man enough?`,

  (details) => `Horny ${details.maritalStatus.toLowerCase() || 'married'} woman, ${details.age}, from ${details.location}. Need discreet NSA sex tonight. I'm into ${details.interests[0] || 'oral'} and ${details.interests[1] || 'being dominated'}. Looking for well-endowed men who know what they're doing. Can host discreetly or meet at your place. No strings, no drama, just fucking. Send dick pic to get my attention.`,

  (details) => `Hot ${details.age}yo woman in ${details.location} needs to get laid ASAP. ${details.maritalStatus || 'Divorced'} and missing good sex. I crave ${details.interests[0] || 'big cock'} and ${details.interests[1] || 'multiple orgasms'}. Can meet tonight at my apartment or yours. Only looking for attractive, clean men with stamina. No time wasters, no relationship talk, just sex. Message me if you can handle a horny woman.`,

  (details) => `${details.maritalStatus} woman from ${details.location}, ${details.age} and desperate for cock tonight. Looking for hung, fit men for one-night stand. I love ${details.interests[0] || 'giving head'} and ${details.interests[1] || 'riding cock'}. Very tight and wet, guaranteed satisfaction. Can host or meet at hotel. Looking for tonight only, no future contact necessary. Clean and expect the same.`,

  (details) => `${details.age}, sexy and soaking wet in ${details.location}. ${details.maritalStatus || 'In an open relationship'} looking for NSA fun tonight. I need ${details.interests[0] || 'hard fucking'} and ${details.interests[1] || 'oral pleasure'}. Can host at my private apartment. Only looking for men who can get hard, stay hard, and make me cum multiple times. One night only, no strings, no questions, just pure animal sex.`
];

// English explicit bio templates for couples
const englishCoupleBioTemplates = [
  (details) => `Hot couple in ${details.location}, she's ${details.age-2}, he's ${details.age+2}. Looking for sex partners tonight. We're ${details.maritalStatus.toLowerCase() || 'married'} and very experienced. She loves ${details.interests[0] || 'double penetration'}, he enjoys ${details.interests[1] || 'watching her get fucked'}. Hosting at our clean, private apartment. Looking for attractive, clean people for one night of unlimited pleasure. Total discretion guaranteed.`,

  (details) => `Couple seeking third for hot threesome tonight in ${details.location}. She's ${details.age-3}, stunning and bi, he's ${details.age+3}, fit and straight. We're into ${details.interests[0] || 'oral'}, ${details.interests[1] || 'anal'} and trying new things. Clean, tested and discrete. Looking for fit female or well-hung male. Quick drink to verify chemistry then straight to bed. One night only, no strings attached.`,

  (details) => `Swinger couple from ${details.location}, both in our ${Math.floor(details.age/10)*10}s, fit bodies, very experienced in group sex and swapping. Looking for singles/couples for tonight only. We enjoy ${details.interests[0] || 'group sex'}, ${details.interests[1] || 'swinging'} and open to most things. Full discretion, clean environment, good vibes. Only message if you can meet tonight.`,

  (details) => `Hot couple in ${details.location} ready to play now. She's ${details.age-4}, blonde with big tits, he's ${details.age+4}, muscular with a large cock. We're ${details.maritalStatus.toLowerCase() || 'in an open relationship'} seeking woman/man/couple for no-limits sex. We enjoy ${details.interests[0] || 'anal'}, ${details.interests[1] || 'bisexual play'} and new experiences. Hosting at our discreet location. Send pics if serious. Tonight only.`,

  (details) => `Couple, both ${details.age}, seeking playmates for sex tonight in ${details.location}. We look good, are clean, discreet and very horny. We have our own place, good alcohol, great mood and strong desires. We love ${details.interests[0] || 'group sex'}, ${details.interests[1] || 'kinky play'} and various fetishes. No commitment needed, no contact afterward, just one perfect night of mutual pleasure and then everyone goes their separate ways.`
];

// --- Enhanced Photo Collections for Adult Dating App  ---
const photoCollections = {
  woman: [
    // Original tasteful suggestive photos without showing faces
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

    // More suggestive/adult-oriented photos for women - expanded set
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
    "https://images.unsplash.com/photo-1603766806347-54cdf3745953?q=80&w=800",  // Woman in heels from behind

    // NEW: Additional explicit one-night stand focused photos for women
    "https://images.unsplash.com/photo-1559570278-eb8d71d06403?q=80&w=800", // Woman in revealing pose on bed
    "https://images.unsplash.com/photo-1566758303763-e456d76a7348?q=80&w=800", // Woman's curves in lingerie
    "https://images.unsplash.com/photo-1613211333457-56e6be2ef825?q=80&w=800", // Woman in transparent nightgown
    "https://images.unsplash.com/photo-1568605645230-8c449571fe52?q=80&w=800", // Woman's legs in fishnet stockings
    "https://images.unsplash.com/photo-1563454759749-aa3209c08b58?q=80&w=800", // Woman in revealing club outfit
    "https://images.unsplash.com/photo-1595623238469-fc58b3839cf6?q=80&w=800", // Woman in wet t-shirt
    "https://images.unsplash.com/photo-1601947078471-f6be36e3807d?q=80&w=800", // Woman's cleavage close-up
    "https://images.unsplash.com/photo-1574539602047-548bf9557352?q=80&w=800", // Woman spreading legs in stockings
    "https://images.unsplash.com/photo-1594139505151-40aea4069643?q=80&w=800", // Woman's butt in thong
    "https://images.unsplash.com/photo-1618333258404-78d8a0832e3b?q=80&w=800", // Woman in provocative pose
    "https://images.unsplash.com/photo-1600623063511-6b10425fde8d?q=80&w=800", // Woman touching herself
    "https://images.unsplash.com/photo-1568219656418-15c329312bf1?q=80&w=800", // Woman in handcuffs
    "https://images.unsplash.com/photo-1537274327090-c8cd4e5f2947?q=80&w=800", // Woman in wet transparent dress
    "https://images.unsplash.com/photo-1596649299486-4cdea56fd59d?q=80&w=800", // Woman in BDSM outfit
    "https://images.unsplash.com/photo-1630322726639-ab1f4b7424a7?q=80&w=800"  // Woman in latex outfit
  ],

  man: [
    // Original tasteful yet suggestive male photos without showing faces
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
    "https://images.unsplash.com/photo-1567013127542-490d757e6aa2?q=80&w=800",  // Man's back with tattoos

    // NEW: Additional explicit one-night stand focused photos for men
    "https://images.unsplash.com/photo-1534604973900-c43ab4c2e0ab?q=80&w=800", // Man's suggestive bulge
    "https://images.unsplash.com/photo-1548863227-3af567fc3b27?q=80&w=800", // Man in boxer briefs with visible outline
    "https://images.unsplash.com/photo-1602962447559-8e07b7778181?q=80&w=800", // Man with hand down pants
    "https://images.unsplash.com/photo-1593111774240-d529f12cf4bb?q=80&w=800", // Man in revealing swimwear
    "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?q=80&w=800", // Man's groin in tight underwear
    "https://images.unsplash.com/photo-1574874171841-5db3db1adb17?q=80&w=800", // Man in BDSM harness
    "https://images.unsplash.com/photo-1553704571-562ab8d94fb9?q=80&w=800", // Man in leather fetish outfit
    "https://images.unsplash.com/photo-1603077011543-b45805aaf88f?q=80&w=800", // Man in revealing tank top
    "https://images.unsplash.com/photo-1598971861713-54887ebd8a23?q=80&w=800", // Man in just a towel
    "https://images.unsplash.com/photo-1609152768388-83b36e244f7e?q=80&w=800", // Man grabbing crotch
    "https://images.unsplash.com/photo-1596548438637-1189c1789ba4?q=80&w=800", // Man with sex toy
    "https://images.unsplash.com/photo-1618072596892-20861185e27c?q=80&w=800", // Naked man covered by sheet
    "https://images.unsplash.com/photo-1517101724602-c257fe568157?q=80&w=800", // Man in bondage gear
    "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?q=80&w=800", // Man in suggestive pose
    "https://images.unsplash.com/photo-1576678927484-cc907957088c?q=80&w=800"  // Man in just open shirt
  ],

  couple: [
    // Original tasteful yet suggestive couple photos without showing faces
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
    "https://images.unsplash.com/photo-1628157239582-25632655a869?q=80&w=800",  // Couple in bed sheets only

    // NEW: Additional explicit one-night stand focused photos for couples
    "https://images.unsplash.com/photo-1527155431803-75135b1ee909?q=80&w=800", // Couple having sex silhouette
    "https://images.unsplash.com/photo-1519075189696-41c3e6c31622?q=80&w=800", // Couple with woman straddling man
    "https://images.unsplash.com/photo-1484746191154-516d576bb5f9?q=80&w=800", // Couple with man behind woman
    "https://images.unsplash.com/photo-1531172297406-378df642d777?q=80&w=800", // Couple in clearly sexual position
    "https://images.unsplash.com/photo-1554308281-75ea91cbb4a2?q=80&w=800", // Couple in sex swing
    "https://images.unsplash.com/photo-1541911087797-f89237bd95d0?q=80&w=800", // Couple with bondage equipment
    "https://images.unsplash.com/photo-1524386189627-88c26ac1cc69?q=80&w=800", // Couple in threesome suggestion
    "https://images.unsplash.com/photo-1586058581290-eb0e19c66a52?q=80&w=800", // Couple with adult toys
    "https://images.unsplash.com/photo-1542811970-1f76e2c15ad1?q=80&w=800", // Couple's hands on private areas
    "https://images.unsplash.com/photo-1519741370946-331514a838a4?q=80&w=800", // Couple post-sex in bed
    "https://images.unsplash.com/photo-1596797038530-2c107229654b?q=80&w=800", // Couple in tantric position
    "https://images.unsplash.com/photo-1500917293891-ef795e70e1f6?q=80&w=800", // Couple in explicit embrace
    "https://images.unsplash.com/photo-1574874571895-081a778e1d7f?q=80&w=800", // Couple with BDSM accessories
    "https://images.unsplash.com/photo-1604519765359-53cd678a1428?q=80&w=800", // Orgy suggestion with multiple people
    "https://images.unsplash.com/photo-1602008672975-1fdad5771292?q=80&w=800"  // Couple swinging suggestion
  ],

  // NEW: Group/orgy photos for more variety
  group: [
    "https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?q=80&w=800", // Group in bed suggestion
    "https://images.unsplash.com/photo-1598136490929-8e5c357bbde6?q=80&w=800", // Multiple people in intimate setting
    "https://images.unsplash.com/photo-1564417947365-8dbc9227d173?q=80&w=800", // Orgy suggestion silhouette
    "https://images.unsplash.com/photo-1574680096145-d1b3e8bfaa6a?q=80&w=800", // Multiple legs in bed
    "https://images.unsplash.com/photo-1576497315838-505a1239954a?q=80&w=800", // Multiple people at party in suggestive poses
    "https://images.unsplash.com/photo-1517263904808-5dc91e3e7044?q=80&w=800", // Swingers party suggestion
    "https://images.unsplash.com/photo-1563237023-b1e970526dcb?q=80&w=800", // Group in hot tub
    "https://images.unsplash.com/photo-1517456793572-1d8efd6dc135?q=80&w=800", // Multiple couples in bed
    "https://images.unsplash.com/photo-1594099462522-c1906b3eeb3a?q=80&w=800", // Swinger party suggestion
    "https://images.unsplash.com/photo-1596210705982-8c6968fd7591?q=80&w=800", // Multiple bodies intertwined
    "https://images.unsplash.com/photo-1540552999122-a0ac7f1c6e08?q=80&w=800", // Group sex suggestion
    "https://images.unsplash.com/photo-1566043010637-1cdae6bd0922?q=80&w=800"  // Multiple people in revealing clothing
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
  // 80% chance to use explicit adult-oriented nickname for one-night stand site
  if (Math.random() < 0.8) {
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

    // --- 1. Seed Users with Explicit One-Night Stand Focused Data ---
    if (usersToCreate > 0) {
      logger.info(`Seeding ${usersToCreate} users with explicit one-night stand profiles...`);
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
        if (iAm !== 'couple' && Math.random() > 0.7) {
          nickname = `${nickname} `;
        }

        // Generate matching username or use a cool nickname
        const username = generateUsername(nickname);

        // Generate appropriate looking for options (using valid values only)
        let lookingFor;
        const validLookingForOptions = ["women", "men", "couples"];

        // Adjust distributions for one-night stand focus
        if (iAm === 'couple') {
          // Couples on one-night stand sites often look for women or other couples
          const preferences = Math.random() < 0.7 ?
            ['women', 'couples'] : validLookingForOptions;
          lookingFor = getRandomUniqueElements(preferences, getRandomInt(1, preferences.length));
        } else if (iAm === 'woman') {
          // Women on one-night stand sites more often looking for men or couples
          const preferences = Math.random() < 0.7 ?
            ['men', 'couples'] : validLookingForOptions;
          lookingFor = getRandomUniqueElements(preferences, getRandomInt(1, preferences.length));
        } else { // man
          // Men on one-night stand sites primarily looking for women
          const preferences = Math.random() < 0.85 ?
            ['women'] : ['women', 'couples'];
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

        // Set age ranges more realistically for one-night stand site
        let age;
        if (iAm === 'couple') {
          age = getRandomInt(25, 50); // Couples tend to be in prime adult years
        } else if (iAm === 'woman') {
          age = getRandomInt(21, 45); // Women tend to be younger on these sites
        } else { // man
          age = getRandomInt(24, 55); // Men have wider age range
        }

        // Select appropriate account tier
        let accountTier;
        if (iAm === 'woman') {
          accountTier = Math.random() < 0.8 ? 'FEMALE' : getRandomElement(['FREE', 'PAID']);
        } else if (iAm === 'couple') {
          accountTier = Math.random() < 0.7 ? 'COUPLE' : getRandomElement(['FREE', 'PAID']);
        } else { // man
          accountTier = Math.random() < 0.5 ? 'PAID' : 'FREE';
        }

        // Select interest count based on account tier - more explicit interests for one-night stands
        const interestCount = accountTier === 'FREE' ? getRandomInt(3, 5) : getRandomInt(5, 8);

        // Select non-duplicate interests
        const interests = getRandomUniqueElements(interestsBank, interestCount);

        // Select non-duplicate into tags - more for paid accounts and more explicit for one-night stands
        const intoTagsCount = accountTier === 'FREE' ? getRandomInt(3, 5) : getRandomInt(5, 8);
        const intoTags = getRandomUniqueElements(intoTagsOptions, intoTagsCount);

        // Select non-duplicate turn-ons - more for paid accounts and more explicit for one-night stands
        const turnOnsCount = accountTier === 'FREE' ? getRandomInt(3, 5) : getRandomInt(5, 8);
        const turnOns = getRandomUniqueElements(turnOnsOptions, turnOnsCount);

        // Select marital status appropriate to user type and one-night stand focus
        let maritalStatus;
        if (iAm === 'couple') {
          // Couples on one-night stand sites often married or in relationships
          maritalStatus = getRandomElement([
            'Married', 'In a relationship', 'Open relationship'
          ]);
        } else if (iAm === 'woman') {
          // Women on one-night stand sites often single or in relationship
          maritalStatus = getRandomElement([
            'Single', 'Married', 'Divorced', 'In a relationship', 'It\'s complicated'
          ]);
        } else { // man
          // Men on one-night stand sites often married or single
          maritalStatus = getRandomElement([
            'Single', 'Married', 'Divorced', 'In a relationship'
          ]);
        }

        // Double check that maritalStatus is a valid value
        const validMaritalStatuses = ["Single", "Married", "Divorced", "Separated", "Widowed",
                                     "In a relationship", "It's complicated",
                                     "Open relationship", "Polyamorous", ""];
        if (!validMaritalStatuses.includes(maritalStatus)) {
          maritalStatus = "Single"; // Fallback to a safe default
        }

        // Build user details object with focus on one-night stands
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
          seedGenerated: true, // Mark as generated by seed for future reference
          oneNightStandFocus: true // Flag to indicate this is for one-night stands
        };

        // Select bio template based on user type with 80% Hebrew (Israel focus), 20% English
        let bioTemplate;
        const useHebrew = Math.random() < 0.8;

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

        // One-night stand profiles often have higher online rates
        const userData = {
          nickname,
          username,
          email: `${username}@example.com`,
          password: hashedPassword,
          accountTier,
          details: userDetails,
          isOnline: Math.random() < 0.5, // Higher online rate for active one-night stand site
          lastActive: new Date(Date.now() - getRandomInt(0, 1000 * 60 * 60 * 48)), // Very recent activity
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

    // --- 2. Seed Photos with more explicit images for one-night stands ---
    logger.info('Seeding photos for users with explicit one-night stand focused images...');
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
      else if (userType === 'couple') {
        // Occasionally use group photos for couples in one-night stand site
        photoCollection = Math.random() < 0.3 ?
          [...photoCollections.couple, ...photoCollections.group] :
          photoCollections.couple;
      }
      else photoCollection = photoCollections[userType] || photoCollections.man;

      // Determine how many photos based on account tier - more photos for one-night stand profiles
      let numPhotos;
      if (user.accountTier === 'PAID' || user.accountTier === 'FEMALE' || user.accountTier === 'COUPLE') {
        numPhotos = getRandomInt(4, MAX_PHOTOS_PER_USER);
      } else {
        numPhotos = getRandomInt(2, 4); // Free accounts get fewer photos
      }

      // Shuffle the collection and take the first numPhotos
      const shuffledPhotos = [...photoCollection].sort(() => 0.5 - Math.random());
      const selectedPhotos = shuffledPhotos.slice(0, numPhotos);

      const photosToAdd = [];

      // Add the profile picture first (public for one-night stand sites to attract matches)
      photosToAdd.push({
        url: selectedPhotos[0],
        isPrivate: false,
        metadata: {
          uploadedBySeed: true,
          originalName: `${userType}_profile_explicit.jpg`,
          uploadDate: new Date(Date.now() - getRandomInt(0, 1000 * 60 * 60 * 24 * 10)) // More recent uploads
        }
      });

      // Add additional photos (many are private in one-night stand sites to entice matches)
      for (let p = 1; p < selectedPhotos.length; p++) {
        // One-night stand sites use private photos as incentive for interaction
        const isPrivate = Math.random() < 0.7; // Higher chance to be private

        const photoData = {
          url: selectedPhotos[p],
          isPrivate: isPrivate,
          metadata: {
            uploadedBySeed: true,
            originalName: `${userType}_explicit_${p + 1}.jpg`,
            uploadDate: new Date(Date.now() - getRandomInt(0, 1000 * 60 * 60 * 24 * 5)) // Very recent uploads
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

    // --- 3. Seed Likes (more interactions for one-night stand site) ---
    logger.info(`Seeding ${NUM_LIKES_TO_SEED} likes between users for one-night stand interactions...`);

    if (createdUserIds.length >= 2) {
      for (let i = 0; i < NUM_LIKES_TO_SEED; i++) {
        // Get random user IDs - weighted to have more interactions for active one-night stand site
        let fromUserId = getRandomElement(createdUserIds);
        let toUserId = getRandomElement(createdUserIds);

        // Ensure we're not liking ourselves
        while (fromUserId === toUserId) {
          toUserId = getRandomElement(createdUserIds);
        }

        try {
          // Create like with 90% being mutual (higher for one-night stand site)
          const isMutual = Math.random() < 0.9;

          const like = new Like({
            fromUser: fromUserId,
            toUser: toUserId,
            createdAt: new Date(Date.now() - getRandomInt(0, 1000 * 60 * 60 * 48)), // Very recent activity
            status: isMutual ? 'mutual' : 'pending'
          });

          await like.save();

          // If mutual, create the reciprocal like
          if (isMutual) {
            const reciprocalLike = new Like({
              fromUser: toUserId,
              toUser: fromUserId,
              createdAt: new Date(Date.now() - getRandomInt(0, 1000 * 60 * 60 * 24)), // Even more recent
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

      logger.info('Likes seeded successfully for one-night stand interactions');
    } else {
      logger.warn('Not enough users to seed likes. Skipping.');
    }

    // --- 4. Seed Photo Permissions (more approvals for one-night stand site) ---
    logger.info(`Seeding ${NUM_PHOTO_REQUESTS_TO_SEED} photo permissions for one-night stand site...`);

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
        // One-night stand sites have more approved permissions to facilitate quick hookups
        let status;
        const randomStatus = Math.random();
        if (randomStatus < 0.8) {
          status = 'approved'; // 80% approved for one-night stand site
        } else if (randomStatus < 0.95) {
          status = 'pending';  // 15% pending
        } else {
          status = 'denied';   // 5% denied
        }

        try {
          const photoPermission = new PhotoPermission({
            photo: photoId,
            owner: ownerId,
            requester: requesterId,
            status: status,
            requestDate: new Date(Date.now() - getRandomInt(0, 1000 * 60 * 60 * 24 * 3)), // Very recent for active site
            responseDate: status !== 'pending' ?
              new Date(Date.now() - getRandomInt(0, 1000 * 60 * 60 * 12)) : // Quick responses for one-night stands
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

      logger.info('Photo permissions seeded successfully for one-night stand interactions');
    } else {
      logger.warn('Not enough private photos or users to seed photo permissions. Skipping.');
    }

    logger.info('Database seeding completed successfully for explicit one-night stand dating site!');

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
