import requests
from bs4 import BeautifulSoup
import json
import os
import time
import random
import re
import logging
from urllib.parse import urljoin  # For handling relative URLs robustly
import bcrypt
from datetime import datetime, timedelta

# --- Configuration ---
BASE_URL = "https://www.zbeng.co.il"
# The view=2 parameter is used here. If you need to scrape other views (e.g., view=3),
# you'll need to change this template or run the script multiple times.
LISTING_URL_TEMPLATE = "https://www.zbeng.co.il/online.aspx?page={page_num}&view=2"

# AJAX URL for fetching popup details (you confirmed this URL)
USER_DETAILS_AJAX_URL_TEMPLATE = "https://www.zbeng.co.il/api/getprofile?customerId={user_id}"

OUTPUT_DIR = "scraped_data_zbeng_full_refactor"  # New output directory
PHOTOS_SUBDIR = "photos"
JSON_FILENAME = "users_data_complete.json"
SEED_JSON_FILENAME = "seed_users.json"  # User model compatible format
LOG_FILENAME = "scraper.log"
SALT_ROUNDS = 12  # For bcrypt password hashing

# --- Logging Setup ---
# Ensure OUTPUT_DIR exists before setting up FileHandler
if not os.path.exists(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR)

# Configure console to handle Hebrew output properly
import sys
import codecs
if sys.stdout.encoding != 'utf-8':
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
if sys.stderr.encoding != 'utf-8':
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(filename)s:%(lineno)d - %(message)s',  # Added filename and line no
    datefmt='%Y-%m-%d %H:%M:%S',
    handlers=[
        logging.FileHandler(os.path.join(OUTPUT_DIR, LOG_FILENAME), mode='w', encoding='utf-8'),
        logging.StreamHandler()  # To see logs in console as well
    ]
)

# --- Requests Session ---
session = requests.Session()
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
    'Accept-Language': 'en-US,en;q=0.9,he;q=0.8',
    'Referer': BASE_URL + '/',
    'X-Requested-With': 'XMLHttpRequest'  # Often required for AJAX calls
})


# --- Helper Functions ---
def get_safe_text(element, default_val=None):
    """Safely get text from a BeautifulSoup element, stripping whitespace."""
    return element.text.strip() if element else default_val


# New helper functions for User model conversion
def hebrew_to_english_gender(gender_he):
    """Convert Hebrew gender to English format matching User model."""
    if gender_he == "בת":
        return "female"
    elif gender_he == "בן":
        return "male"
    elif gender_he == "זוג":
        return "couple"
    return "other"


def hebrew_gender_to_iam(gender_he):
    """Convert Hebrew gender to iAm field format."""
    if gender_he == "בת":
        return "woman"
    elif gender_he == "בן":
        return "man"
    elif gender_he == "זוג":
        return "couple"
    return ""


def determine_account_tier(gender, is_couple=False):
    """Determine account tier based on gender and couple status."""
    if is_couple:
        return "COUPLE"
    elif gender == "female":
        return "FEMALE"
    else:
        # Randomly assign some males as PAID
        return "PAID" if random.random() < 0.3 else "FREE"


def generate_username(nickname):
    """Generate username from nickname."""
    if not nickname:
        return f"user_{random.randint(10000, 99999)}"
    # Clean nickname - handle Hebrew characters by removing them
    # Keep only ASCII alphanumeric characters
    base = re.sub(r'[^a-zA-Z0-9]', '', nickname)
    if not base:
        # If no ASCII characters, try transliteration or use random
        base = f"user_{random.randint(1000, 9999)}"
    else:
        base = base.lower()
    # Add random number if needed
    if random.random() < 0.5:
        base += str(random.randint(1, 999))
    return base


def marital_status_hebrew_to_english(status_he):
    """Convert Hebrew marital status to English."""
    mapping = {
        "רווק": "Single",
        "רווקה": "Single",
        "נשוי": "Married",
        "נשואה": "Married",
        "גרוש": "Divorced",
        "גרושה": "Divorced",
        "אלמן": "Widowed",
        "אלמנה": "Widowed",
        "במערכת יחסים": "In a relationship",
        "פנוי": "Single",
        "פנויה": "Single"
    }
    return mapping.get(status_he, "")


def create_bio_from_about_me(about_me_text, age=None, location=None):
    """Create a bio from scraped about me text."""
    if not about_me_text:
        return f"Just joined! {age} years old from {location or 'Israel'}. Looking forward to meeting interesting people."
    
    # Truncate if too long
    if len(about_me_text) > 500:
        about_me_text = about_me_text[:497] + "..."
    
    return about_me_text


def parse_tags_from_spans(element, class_name="sel1"):
    """Extracts text from all <span class="sel1"> (or other class) tags within a given element."""
    if not element:
        return []
    return [span.text.strip() for span in element.find_all('span', class_=class_name)]


def parse_detailed_gender_age_location(text_content):
    """
    Parses detailed gender, age, location, and marital status from text like:
    'רווק בן 20 מבאר שבע' (Single man 20 from Beer Sheva)
    Returns (marital_status_he, gender_he, age_num, location_he)
    """
    if not text_content:
        return None, None, None, None

    original_text = text_content
    marital_status_he, gender_he, age_num, location_he = None, None, None, None

    marital_options = ["רווק", "רווקה", "נשוי", "נשואה", "גרוש", "גרושה", "אלמן", "אלמנה", "במערכת יחסים", "פנוי",
                       "פנויה"]
    for status_option in marital_options:
        if text_content.startswith(status_option):
            marital_status_he = status_option
            text_content = text_content[len(status_option):].strip()
            break

    gender_age_match = re.search(r"(בן|בת)\s*(\d+)", text_content)  # בן (male), בת (female)
    if gender_age_match:
        gender_he = gender_age_match.group(1)
        try:
            age_num = int(gender_age_match.group(2))
        except ValueError:
            age_num = None
        text_content = text_content[gender_age_match.end():].strip()

    if text_content.startswith("מ"):  # מ (from)
        location_he = text_content[1:].strip()
    elif text_content:
        location_he = text_content.strip()

    # Log if parsing seems incomplete for non-empty original strings, to help debug new formats
    if original_text and not (marital_status_he and gender_he and age_num and location_he):
        logging.debug(
            f"Detailed parsing for '{original_text}' gave: M='{marital_status_he}', G='{gender_he}', A='{age_num}', L='{location_he}'")

    return marital_status_he, gender_he, age_num, location_he


def parse_gender_age_location_simple(text):
    """Simpler parser for 'בת 32, נהריה' format on listing page."""
    gender, age, location = None, None, None
    
    # Debug log the input
    logging.debug(f"Parsing simple gender/age/location from: '{text}'")
    
    parts = text.split(',')
    if len(parts) > 0:
        first_part = parts[0].strip()
        if len(parts) > 1:
            location = parts[1].strip()

        match = re.match(r"(בת|בן|זוג)\s*(\d+)", first_part)
        if match:
            gender_he = match.group(1)
            if gender_he == "בת":
                gender = "female"
            elif gender_he == "בן":
                gender = "male"
            elif gender_he == "זוג":
                gender = "couple"
            try:
                age = int(match.group(2))
            except ValueError:
                age = None
        else:
            logging.debug(f"No match for gender/age pattern in: '{first_part}'")
    
    logging.debug(f"Parsed result - Gender: {gender}, Age: {age}, Location: {location}")
    return gender, age, location


# --- Core Scraping Functions ---
def get_listing_page_html(url):
    """Fetch HTML content for listing pages (uses GET)."""
    try:
        response = session.get(url, timeout=25)
        response.raise_for_status()
        # Force UTF-8 encoding for Hebrew text
        response.encoding = 'utf-8'
        return response.text
    except requests.RequestException as e:
        logging.error(f"Error fetching listing page {url}: {e}")
        return None


def parse_users_from_listing(html_content):
    """Extract user IDs, basic info, and max page number from listing page HTML."""
    soup = BeautifulSoup(html_content, 'html.parser')
    users_found = []
    max_page_from_pager = 0

    user_containers = soup.find_all('div', class_='adv')
    if not user_containers:
        logging.debug("No user containers with class 'adv' found on the page.")

    for container in user_containers:
        user_id, nickname_listing, photo_url_listing, gender_listing, age_listing, location_listing = (None,) * 6

        onclick_attr = container.get('onclick')
        if onclick_attr:
            match = re.search(r"showProfil\((\d+)\)", onclick_attr)
            if match: user_id = match.group(1)

        if not user_id:  # Fallback if onclick is on a child element
            clickable_child = container.find(attrs={"onclick": re.compile(r"showProfil\((\d+)\)")})
            if clickable_child:
                match = re.search(r"showProfil\((\d+)\)", clickable_child['onclick'])
                if match: user_id = match.group(1)

        if not user_id:
            logging.warning(f"Could not extract user_id from container: {str(container)[:200]}")
            continue

        img_tag = container.find('img', id=re.compile(r"imgCustomer_"))
        if img_tag and img_tag.get('src'):
            photo_url_relative = img_tag['src']
            # Ensure customerId is correct or construct the URL
            if f"customerId={user_id}" in photo_url_relative or "customerId=" not in photo_url_relative:
                photo_url_full = urljoin(BASE_URL + "/", photo_url_relative.lstrip('/'))
                if "customerId=" not in photo_url_full:  # If still no customerId, append it
                    photo_url_full = f"{photo_url_full}{'&' if '?' in photo_url_full else '?'}customerId={user_id}&number=1"
                elif "number=" not in photo_url_full:  # Ensure number=1 if not present
                    photo_url_full = f"{photo_url_full}&number=1"

            else:  # customerId in img src is different, reconstruct.
                logging.debug(
                    f"customerId in img src for {user_id} might be different or missing 'number=1'. Constructing photo URL.")
                photo_url_full = urljoin(BASE_URL + "/", f"picture.ashx?customerId={user_id}&number=1")
        else:  # Fallback if no specific img tag found
            photo_url_full = urljoin(BASE_URL + "/", f"picture.ashx?customerId={user_id}&number=1")
        photo_url_listing = photo_url_full

        inf1_div = container.find('div', class_='inf1')
        if inf1_div and inf1_div.text:
            text_content = inf1_div.text.strip()
            logging.debug(f"Parsing inf1 text for user {user_id}: '{text_content}'")
            gender_listing, age_listing, location_listing = parse_gender_age_location_simple(text_content)
            logging.debug(f"Parsed results - Gender: {gender_listing}, Age: {age_listing}, Location: {location_listing}")

        nickname_p = container.find('p', id=re.compile(r"lblNickName_"))
        if nickname_p: nickname_listing = nickname_p.text.strip()

        users_found.append({
            'user_id': user_id, 'nickname_listing': nickname_listing, 'photo_url_listing': photo_url_listing,
            'gender_listing': gender_listing, 'age_listing': age_listing, 'location_listing': location_listing
        })

    pager_links = soup.select('a[id*="contentMain_customers_pager_rptPager_lnkPage_"]')
    for link in pager_links:
        try:
            page_num_text = link.text.strip()
            if page_num_text.isdigit():
                page_num = int(page_num_text)
                if page_num > max_page_from_pager: max_page_from_pager = page_num
        except (ValueError, AttributeError):
            continue

    if max_page_from_pager == 0:  # Fallback if numbers not in text
        all_page_hrefs = soup.select('div[id*="pager"] a[href*="page="]')
        for link in all_page_hrefs:
            href = link.get('href')
            if href:
                match = re.search(r"page=(\d+)", href)
                if match:
                    try:
                        page_num = int(match.group(1))
                        if page_num > max_page_from_pager: max_page_from_pager = page_num
                    except ValueError:
                        continue

    logging.debug(
        f"Parsed {len(users_found)} users from listing. Max page from pager: {max_page_from_pager if max_page_from_pager > 0 else 'N/A'}")
    return users_found, max_page_from_pager


def parse_user_details_from_json(popup_json, user_id_for_photo_context):
    """Parses the JSON response from the user details API."""
    details = {"source_url_for_popup_photos": USER_DETAILS_AJAX_URL_TEMPLATE.format(user_id=user_id_for_photo_context)}
    
    # Map JSON fields to our expected fields
    details['nickname_popup'] = popup_json.get('name')
    
    # Parse gender from genderId
    gender_id = popup_json.get('genderId')
    if gender_id == 1:
        details['gender_popup_en'] = "male"
        details['gender_popup_he'] = "בן"
    elif gender_id == 2:
        details['gender_popup_en'] = "female"
        details['gender_popup_he'] = "בת"
    elif gender_id == 3:
        details['gender_popup_en'] = "couple"
        details['gender_popup_he'] = "זוג"
    
    # Parse detailed info from 'me' field (contains: "רווק בן 46")
    me_text = popup_json.get('me', '')
    if me_text:
        marital_h, gender_h, age_n, loc_h = parse_detailed_gender_age_location(me_text)
        details['marital_status_popup_he'] = marital_h
        if age_n:
            details['age_popup'] = age_n
        # Location is not in 'me' field but could be parsed from other fields
    
    # Other fields with correct names - handle HTML and encoding
    about_me_raw = popup_json.get('aboutMe', '')
    if about_me_raw:
        # Parse HTML content
        soup = BeautifulSoup(about_me_raw, 'html.parser')
        # Get text content directly, preserving structure
        about_me_text = soup.get_text(separator=' ', strip=True)
        # Clean up extra spaces and preserve paragraph breaks
        about_me_text = re.sub(r'\s+', ' ', about_me_text)
        about_me_text = about_me_text.replace('<br>', '\n').replace('</p><p', '</p>\n<p')
        # Final cleanup
        about_me_text = about_me_text.strip()
        details['about_me_popup'] = about_me_text
    else:
        details['about_me_popup'] = ''
    
    details['general_description_popup'] = popup_json.get('general', '')
    
    # Stats with correct field names
    details['rating_popup'] = popup_json.get('score', '')
    details['view_count_popup'] = str(popup_json.get('viewCount', ''))
    details['favorite_count_popup'] = str(popup_json.get('favoritCount', ''))  # Note: typo in API
    
    # Dates
    details['registration_date_popup'] = popup_json.get('createdOn', '')
    details['last_login_popup'] = popup_json.get('lastLogIn', '')
    
    # Tags - these are string fields, we'll split them
    iam_tags = popup_json.get('iamTag', '')
    if iam_tags:
        details['i_am_tags_popup'] = [tag.strip() for tag in iam_tags.split(',')]
    else:
        details['i_am_tags_popup'] = []
    
    details['iam_into_summary_popup'] = popup_json.get('basic', '')
    
    looking_for_tags = popup_json.get('iamLookingForTag', '')
    if looking_for_tags:
        details['iam_looking_for_tags_popup'] = [tag.strip() for tag in looking_for_tags.split(',')]
    else:
        details['iam_looking_for_tags_popup'] = []
    
    turns_on_tags = popup_json.get('makesMeItTag', '')
    if turns_on_tags:
        details['turns_me_on_tags_popup'] = [tag.strip() for tag in turns_on_tags.split(',')]
    else:
        details['turns_me_on_tags_popup'] = []
    
    # Photos - check for img1, img2, img3, img4 flags
    popup_photo_urls = []
    
    # Construct photo URLs based on the pattern and img flags
    base_photo_url = f"picture.ashx?customerId={user_id_for_photo_context}"
    
    # Main photo (always try number=1)
    main_photo_url = urljoin(BASE_URL, f"{base_photo_url}&number=1")
    popup_photo_urls.append(main_photo_url)
    
    # Additional photos
    for i in range(2, 5):  # img2, img3, img4
        img_flag = popup_json.get(f'img{i}', False)
        if img_flag:
            photo_url = urljoin(BASE_URL, f"{base_photo_url}&number={i}")
            popup_photo_urls.append(photo_url)
    
    details['photo_urls_popup'] = popup_photo_urls
    
    return details


def parse_user_details_from_popup_html(popup_html_content, user_id_for_photo_context):
    """Parses the HTML content of the user details popup."""
    if not popup_html_content:
        logging.warning(f"Popup HTML content for user {user_id_for_photo_context} is empty, cannot parse.")
        return {"error": "Popup HTML was empty",
                "source_url_for_popup_photos": USER_DETAILS_AJAX_URL_TEMPLATE.format(user_id=user_id_for_photo_context)}

    soup = BeautifulSoup(popup_html_content, 'html.parser')
    details = {"source_url_for_popup_photos": USER_DETAILS_AJAX_URL_TEMPLATE.format(
        user_id=user_id_for_photo_context)}  # Store source for debugging relative URLs

    details['nickname_popup'] = get_safe_text(soup.find('h1', id='lblNickName', class_='mobUserTitle'))

    lbl_me_span = soup.find('span', id='lblMe', class_='opt')
    if lbl_me_span:
        marital_h, gender_h, age_n, loc_h = parse_detailed_gender_age_location(lbl_me_span.text.strip())
        details['marital_status_popup_he'] = marital_h
        details['gender_popup_he'] = gender_h
        details['gender_popup_en'] = "male" if gender_h == "בן" else (
            "female" if gender_h == "בת" else ("couple" if gender_h == "זוג" else None))
        details['age_popup'] = age_n
        details['location_popup_he'] = loc_h

    details['rating_popup'] = get_safe_text(soup.find('div', id='lblScore', class_='qx'))
    details['registration_date_popup'] = get_safe_text(soup.find('div', id='lblCreatedOn', class_='qx'))
    details['view_count_popup'] = get_safe_text(soup.find('div', id='lblViewCount', class_='qx'))
    details['favorite_count_popup'] = get_safe_text(soup.find('div', id='lblFavoritCount', class_='qx'))
    details['last_login_popup'] = get_safe_text(soup.find('div', id='lblLastLogIn', class_='qx'))

    about_me_p = soup.find('p', id='lblAboutMe')
    if about_me_p:
        all_texts = [t.strip() for t in about_me_p.find_all(string=True, recursive=True) if t.strip()]
        details['about_me_popup'] = "\n".join(all_texts)

    general_span = soup.find('span', id='lblGeneral', class_='opt')
    if general_span: details['general_description_popup'] = get_safe_text(general_span)

    details['i_am_tags_popup'] = parse_tags_from_spans(soup.find('p', id='lblIamTag'))
    details['iam_into_summary_popup'] = get_safe_text(soup.find('p', id='lblBasic'))
    details['iam_looking_for_tags_popup'] = parse_tags_from_spans(soup.find('p', id='lblIamLookingForTag'))
    details['turns_me_on_tags_popup'] = parse_tags_from_spans(soup.find('p', id='lblMakesMeItTag'))

    popup_photo_urls = []
    main_popup_img = soup.find('img', id='imgCustomer1')
    if main_popup_img and main_popup_img.get('src'):
        src = main_popup_img['src']
        popup_photo_urls.append(urljoin(USER_DETAILS_AJAX_URL_TEMPLATE.format(user_id=user_id_for_photo_context), src))

    thumbnail_divs = soup.select('div.prevpic div.col-xs-4')
    for div in thumbnail_divs:
        if div.get('style') and 'display: none' in div.get('style', '').lower():
            continue
        thumb_img = div.find('img', class_='smpic')
        if thumb_img and thumb_img.get('src') and 'transparent1px.gif' not in thumb_img['src']:
            src = thumb_img['src']
            popup_photo_urls.append(
                urljoin(USER_DETAILS_AJAX_URL_TEMPLATE.format(user_id=user_id_for_photo_context), src))

    final_popup_photos = set()
    for p_url in popup_photo_urls:
        if not p_url: continue
        # Ensure customerId is present and correct
        if f"customerId={user_id_for_photo_context}" not in p_url:
            if "customerId=" in p_url:  # Has a customerId, but it's different
                p_url = re.sub(r"customerId=\d+", f"customerId={user_id_for_photo_context}", p_url)
            elif "?" in p_url:  # Has other params
                p_url = f"{p_url}&customerId={user_id_for_photo_context}"
            else:  # No params
                p_url = f"{p_url}?customerId={user_id_for_photo_context}"
        final_popup_photos.add(p_url)

    details['photo_urls_popup'] = sorted(list(final_popup_photos))
    return details


def fetch_and_parse_user_details(user_id):
    """
    Fetches (AJAX) and then parses user details from their profile popup.
    YOU MUST CONFIGURE THE http_method, payload_data, or payload_json
    based on your browser's Developer Tools Network inspection for the
    /api/getprofile call.
    """
    details_url = USER_DETAILS_AJAX_URL_TEMPLATE.format(user_id=user_id)

    # === START: USER CONFIGURATION AREA FOR API CALL ===
    # Based on your browser's Network Tab for the successful /api/getprofile call:
    # 1. What is the "Request Method"? (e.g., "GET", "POST")
    # 2. If "POST", what is the "Content-Type" header?
    # 3. If "POST", what is in the "Request Payload" / "Form Data" / "JSON Payload"?

    # Use POST method as required by the API
    http_method = "POST"
    # Try with form data
    payload_data = {"customerId": user_id}
    payload_json = None
    # === END: USER CONFIGURATION AREA FOR API CALL ===

    logging.info(f"Fetching popup details for user_id: {user_id} using {http_method} to {details_url}")
    if payload_data not in [None, {}]: logging.info(f"With form data: {payload_data}")
    if payload_json is not None: logging.info(f"With JSON data: {payload_json}")

    popup_content = None
    try:
        if http_method == "POST":
            response = session.post(details_url, data=payload_data, json=payload_json, timeout=25)
        elif http_method == "GET":
            response = session.get(details_url, timeout=25)
        else:
            logging.error(f"Unsupported HTTP method configured: {http_method}")
            return {"error": f"Unsupported HTTP method: {http_method}", "description_popup": "Config error"}

        logging.debug(f"Raw Response status for {user_id} ({details_url}): {response.status_code}")
        response.raise_for_status()

        # Force UTF-8 encoding for Hebrew text
        response.encoding = 'utf-8'
        popup_content = response.text

    except requests.RequestException as e:
        logging.error(f"RequestException during {http_method} to {details_url} for user_id {user_id}: {e}")
        if e.response is not None:
            logging.error(
                f"Response status: {e.response.status_code}. Response text (first 300 chars): {e.response.text[:300]}")
        return {"error": f"Failed to fetch popup data ({http_method} tried): {e}", "description_popup": "Fetch error"}

    if not popup_content:
        logging.error(
            f"Fetched popup content for user_id {user_id} is EMPTY (after successful status code). URL: {details_url}")
        return {"error": "Fetched popup content is empty", "description_popup": "Fetch error - empty content"}

    # Check if response is JSON
    try:
        popup_json = json.loads(popup_content)
        return parse_user_details_from_json(popup_json, user_id)
    except json.JSONDecodeError:
        # If not JSON, try HTML parsing
        return parse_user_details_from_popup_html(popup_content, user_id)


def download_photo(photo_url, user_id, photos_dir, photo_label="photo", gender=None):
    """Download and save user photo if URL is valid, with a label (listing, popup_1, etc.)."""
    if not photo_url or 'transparent1px.gif' in photo_url.lower():
        logging.debug(f"Skipping download for {user_id} - {photo_label}: No valid URL ('{photo_url}').")
        return None

    try:
        photo_number_match = re.search(r"number=(\d+)", photo_url)
        photo_num_suffix = f"_n{photo_number_match.group(1)}" if photo_number_match else ""
        safe_label = re.sub(r'[^\w-]', '', photo_label)
        
        # Determine prefix based on gender
        prefix = "user"
        if gender == "female":
            prefix = "woman"
        elif gender == "male":
            prefix = "man"
        elif gender == "couple":
            prefix = "couple"
        else:
            # Log when gender is None or unknown
            logging.debug(f"Unknown gender '{gender}' for user {user_id}, using default 'user' prefix")
            
        photo_filename_base = f"{prefix}_{user_id}_{safe_label}{photo_num_suffix}"

        original_extension_match = re.search(r'\.(jpg|jpeg|png|gif|webp)$', photo_url.split('?')[0], re.IGNORECASE)
        extension = original_extension_match.group(0).lower() if original_extension_match else ".jpg"
        photo_filename = photo_filename_base + extension

        file_path = os.path.join(photos_dir, photo_filename)

        if os.path.exists(file_path) and os.path.getsize(file_path) > 0:
            # Check if existing file is a placeholder
            file_size = os.path.getsize(file_path)
            # Common placeholder sizes in bytes
            placeholder_sizes_bytes = [24381, 15905, 16971]  # 24.38KB, 15.9KB, and 16.97KB actual sizes
            
            if file_size in placeholder_sizes_bytes:
                logging.info(f"Existing photo {file_path} is a placeholder (size: {file_size} bytes). Deleting.")
                try:
                    os.remove(file_path)
                except OSError as e_rem:
                    logging.error(f"Could not delete placeholder file {file_path}: {e_rem}")
                return None
            logging.debug(f"Photo {file_path} already exists (size: {file_size} bytes). Skipping.")
            return file_path

        logging.info(f"Downloading {photo_label} for user_id {user_id} from {photo_url} to {file_path}")
        response = session.get(photo_url, stream=True, timeout=30)
        response.raise_for_status()

        content_type = response.headers.get('content-type', '').lower()
        new_ext = extension  # Default to original/guessed extension
        if 'jpeg' in content_type or 'jpg' in content_type:
            new_ext = '.jpg'
        elif 'png' in content_type:
            new_ext = '.png'
        elif 'gif' in content_type:
            new_ext = '.gif'
        elif 'webp' in content_type:
            new_ext = '.webp'

        if new_ext != extension:
            photo_filename = photo_filename_base + new_ext
            file_path = os.path.join(photos_dir, photo_filename)
            logging.debug(f"Updated photo filename to {file_path} based on content-type: {content_type}")

        with open(file_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=16384):
                f.write(chunk)

        # Check file size after download
        file_size = os.path.getsize(file_path)
        # Common placeholder sizes in bytes
        placeholder_sizes_bytes = [24381, 15905, 16971]  # 24.38KB, 15.9KB, and 16.97KB actual sizes
        
        if file_size in placeholder_sizes_bytes:
            logging.warning(f"Downloaded photo {file_path} is a placeholder (size: {file_size} bytes) for {user_id}. Deleting.")
            try:
                os.remove(file_path)
            except OSError as e_rem:
                logging.error(f"Could not delete placeholder file {file_path}: {e_rem}")
            return None
        
        if file_size == 0:
            logging.warning(f"Downloaded photo {file_path} is empty for {user_id}. Deleting.")
            try:
                os.remove(file_path)
            except OSError as e_rem:
                logging.error(f"Could not delete empty file {file_path}: {e_rem}")
            return None
            
        logging.debug(f"Successfully downloaded photo {file_path} (size: {file_size} bytes)")
        return file_path
    except requests.RequestException as e:
        logging.error(f"RequestException downloading {photo_label} for {user_id} from {photo_url}: {e}")
    except IOError as e:
        logging.error(f"IOError saving {photo_label} for {user_id} (URL: {photo_url}): {e}")
    except Exception as e_gen:
        logging.error(f"Generic error downloading/saving {photo_label} for {user_id} from {photo_url}: {e_gen}")
    return None


def convert_to_user_model(zbeng_user_data):
    """Convert zbeng scraped data to User model format."""
    try:
        # Extract basic fields from listing
        nickname = zbeng_user_data.get('nickname_listing') or zbeng_user_data.get('nickname_popup') or f"User{random.randint(1000, 9999)}"
        age = zbeng_user_data.get('age_listing') or zbeng_user_data.get('age_popup') or random.randint(25, 60)
        location = zbeng_user_data.get('location_listing') or zbeng_user_data.get('location_popup_he') or "Tel Aviv"
        
        # Convert gender
        gender_he = zbeng_user_data.get('gender_popup_he') or ""
        gender_en = hebrew_to_english_gender(gender_he)
        if not gender_en and zbeng_user_data.get('gender_popup_en'):
            gender_en = zbeng_user_data.get('gender_popup_en')
        if not gender_en and zbeng_user_data.get('gender_listing'):
            gender_en = zbeng_user_data.get('gender_listing')
        
        # Determine iAm field
        i_am = hebrew_gender_to_iam(gender_he)
        if not i_am and gender_en:
            if gender_en == "female":
                i_am = "woman"
            elif gender_en == "male":
                i_am = "man"
            elif gender_en == "couple":
                i_am = "couple"
        
        # Check if couple
        is_couple = (i_am == "couple" or gender_en == "couple")
        
        # Generate username and email
        username = generate_username(nickname)
        email = f"{username}@example.com"
        
        # Hash password
        plain_password = "password123"
        hashed_password = bcrypt.hashpw(plain_password.encode('utf-8'), bcrypt.gensalt(SALT_ROUNDS)).decode('utf-8')
        
        # Determine account tier
        account_tier = determine_account_tier(gender_en, is_couple)
        
        # Convert marital status
        marital_status_he = zbeng_user_data.get('marital_status_popup_he', '')
        marital_status = marital_status_hebrew_to_english(marital_status_he)
        
        # Create bio
        about_me = zbeng_user_data.get('about_me_popup', '')
        bio = create_bio_from_about_me(about_me, age, location)
        
        # Parse interests from general description or tags
        interests = []
        general_desc = zbeng_user_data.get('general_description_popup', '')
        if general_desc:
            # Simple extraction of potential interests
            potential_interests = ["Dating", "Casual", "Friendship", "Long-term", "Travel", "Outdoors", 
                                 "Movies", "Music", "Fitness", "Food", "Art", "Gaming", "Reading", "Tech"]
            for interest in potential_interests:
                if interest.lower() in general_desc.lower():
                    interests.append(interest)
        
        # If no interests found, add some defaults based on account type
        if not interests:
            if is_couple:
                interests = ["Couples", "Dating", "Social", "Events"]
            elif gender_en == "female":
                interests = ["Dating", "Fashion", "Travel", "Wine"]
            else:
                interests = ["Dating", "Sports", "Music", "Tech"]
        
        # Ensure interests is a list
        if not isinstance(interests, list):
            interests = []
        
        # Convert into tags - handle None values
        into_tags = zbeng_user_data.get('iam_into_summary_popup', [])
        if into_tags is None:
            into_tags = []
        elif isinstance(into_tags, str):
            into_tags = [into_tags]
        
        looking_for_tags = zbeng_user_data.get('iam_looking_for_tags_popup', [])
        if looking_for_tags is None:
            looking_for_tags = []
        
        into_tags = list(into_tags) + list(looking_for_tags)
        into_tags = list(set(filter(None, into_tags)))[:7]  # Limit to 7 unique non-None tags
        
        # Convert turn ons - handle None values
        turn_ons = zbeng_user_data.get('turns_me_on_tags_popup', [])
        if turn_ons is None:
            turn_ons = []
        elif isinstance(turn_ons, str):
            turn_ons = [turn_ons]
        turn_ons = list(set(filter(None, turn_ons)))[:6]  # Limit to 6 non-None values
        
        # Determine looking for based on gender and tags
        looking_for = []
        if i_am == "man":
            looking_for = ["women"]
        elif i_am == "woman":
            looking_for = ["men", "women"] if random.random() < 0.3 else ["men"]
        elif i_am == "couple":
            looking_for = ["women", "couples"]
        
        # Process photos
        photos = []
        
        # Add listing photo if available
        listing_photo_file = zbeng_user_data.get('saved_listing_photo_file')
        if listing_photo_file and os.path.exists(listing_photo_file):
            photos.append({
                "url": f"/uploads/photos/{os.path.basename(listing_photo_file)}",
                "isProfile": True,
                "privacy": "public",
                "isDeleted": False,
                "uploadedAt": datetime.now().isoformat(),
                "metadata": {
                    "filename": os.path.basename(listing_photo_file),
                    "size": os.path.getsize(listing_photo_file) if os.path.exists(listing_photo_file) else 100000,
                    "mimeType": "image/jpeg",
                    "width": 800,
                    "height": 800
                }
            })
        
        # Add popup photos
        popup_photo_files = zbeng_user_data.get('saved_popup_photo_files', [])
        for idx, photo_file in enumerate(popup_photo_files):
            if photo_file and os.path.exists(photo_file):
                # Skip if it's the same as listing photo
                if photo_file == listing_photo_file:
                    continue
                    
                privacy = "public" if idx == 0 else random.choice(["private", "public", "friends_only"])
                photos.append({
                    "url": f"/uploads/photos/{os.path.basename(photo_file)}",
                    "isProfile": False,
                    "privacy": privacy,
                    "isDeleted": False,
                    "uploadedAt": datetime.now().isoformat(),
                    "metadata": {
                        "filename": os.path.basename(photo_file),
                        "size": os.path.getsize(photo_file) if os.path.exists(photo_file) else 100000,
                        "mimeType": "image/jpeg",
                        "width": 800,
                        "height": 800
                    }
                })
        
        # If no photos at all, add a default
        if not photos:
            photos.append({
                "url": "/uploads/seed/placeholder_1.jpg",
                "isProfile": True,
                "privacy": "public",
                "isDeleted": False,
                "uploadedAt": datetime.now().isoformat(),
                "metadata": {
                    "filename": "placeholder_1.jpg",
                    "size": 50000,
                    "mimeType": "image/jpeg",
                    "width": 800,
                    "height": 800
                }
            })
        
        # Generate dates
        created_date = datetime.now() - timedelta(days=random.randint(30, 365))
        last_active = datetime.now() - timedelta(hours=random.randint(1, 168))
        
        # Create User model compatible object
        user_model = {
            "email": email,
            "password": hashed_password,
            "username": username,
            "nickname": nickname,
            "role": "user",
            "accountTier": account_tier,
            "details": {
                "age": age,
                "gender": gender_en if gender_en != "couple" else "other",
                "location": location,
                "bio": bio or "",
                "interests": interests if interests else [],
                "iAm": i_am or "",
                "lookingFor": looking_for if looking_for else [],
                "intoTags": into_tags if into_tags else [],
                "turnOns": turn_ons if turn_ons else [],
                "maritalStatus": marital_status or ""
            },
            "photos": photos,
            "isOnline": random.random() < 0.3,
            "lastActive": last_active.isoformat(),
            "isVerified": True,
            "active": True,
            "createdAt": created_date.isoformat(),
            "updatedAt": last_active.isoformat(),
            "isCouple": is_couple
        }
        
        return user_model
        
    except Exception as e:
        logging.error(f"Error converting user to model format: {e}")
        return None


# --- Main Execution ---
def load_existing_users():
    """Load existing users from all relevant JSON files to avoid duplicates"""
    existing_user_ids = set()
    
    # Check all possible user data files
    data_files = [
        os.path.join(OUTPUT_DIR, JSON_FILENAME),  # users_data_complete.json
        os.path.join(OUTPUT_DIR, SEED_JSON_FILENAME),  # seed_users.json
        os.path.join(OUTPUT_DIR, 'seed_users_with_photos.json'),  # regenerated seed file
    ]
    
    for filepath in data_files:
        if os.path.exists(filepath):
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    for user in data:
                        # Handle different JSON structures
                        user_id = None
                        if 'user_id' in user:  # Original scraped data
                            user_id = user['user_id']
                        elif 'email' in user:  # Seed format
                            user_id = user['email'].split('@')[0]
                        
                        if user_id:
                            existing_user_ids.add(str(user_id))
                logging.info(f"Loaded user IDs from {filepath}: {len(existing_user_ids)} total unique IDs")
            except Exception as e:
                logging.error(f"Error loading {filepath}: {e}")
    
    return existing_user_ids


def main():
    photos_path = os.path.join(OUTPUT_DIR, PHOTOS_SUBDIR)
    if not os.path.exists(photos_path):
        os.makedirs(photos_path)
        logging.info(f"Created photos subdirectory: {photos_path}")

    # Load existing users to avoid duplicates
    existing_user_ids = load_existing_users()
    logging.info(f"Found {len(existing_user_ids)} existing users to skip")
    
    # Load existing data to append to
    all_scraped_user_data = []
    seed_format_users = []
    
    # Load existing scraped data
    json_filepath = os.path.join(OUTPUT_DIR, JSON_FILENAME)
    if os.path.exists(json_filepath):
        try:
            with open(json_filepath, 'r', encoding='utf-8') as f:
                all_scraped_user_data = json.load(f)
            logging.info(f"Loaded {len(all_scraped_user_data)} existing scraped records")
        except Exception as e:
            logging.error(f"Error loading existing scraped data: {e}")
    
    # Load existing seed data
    seed_json_filepath = os.path.join(OUTPUT_DIR, 'seed_users_with_photos.json')
    if os.path.exists(seed_json_filepath):
        try:
            with open(seed_json_filepath, 'r', encoding='utf-8') as f:
                seed_format_users = json.load(f)
            logging.info(f"Loaded {len(seed_format_users)} existing seed format records")
        except Exception as e:
            logging.error(f"Error loading existing seed data: {e}")
    
    processed_user_ids = existing_user_ids.copy()
    
    # Track new vs skipped users
    new_users_count = 0
    skipped_users_count = 0

    logging.info("Attempting to determine total number of pages for listing...")
    first_page_html = get_listing_page_html(LISTING_URL_TEMPLATE.format(page_num=1))
    total_pages = 0
    if first_page_html:
        _, detected_max_page = parse_users_from_listing(first_page_html)
        if detected_max_page > 0:
            total_pages = detected_max_page
            logging.info(f"Successfully determined total pages from pager: {total_pages}")
        else:
            logging.warning(
                "Could not determine total pages from pager. Will attempt to scrape sequentially until 3 empty pages.")
    else:
        logging.error("Failed to fetch the first page. Cannot determine total pages or proceed. Exiting.")
        return

    start_page = 1
    # Override for testing:
    # total_pages = 1
    # logging.info(f"TESTING MODE: Limiting to {total_pages} page(s).")

    page_iterator = range(start_page, total_pages + 1) if total_pages > 0 else iter(lambda: start_page, None)
    consecutive_empty_listing_pages = 0
    MAX_CONSECUTIVE_EMPTY_LISTING = 3

    for current_page_num in page_iterator:
        if total_pages == 0 and consecutive_empty_listing_pages >= MAX_CONSECUTIVE_EMPTY_LISTING:
            logging.info(
                f"Stopping: Reached {MAX_CONSECUTIVE_EMPTY_LISTING} consecutive listing pages with no users parsed (dynamic page count mode).")
            break
        if total_pages > 0 and current_page_num > total_pages:
            logging.info(
                f"Current page {current_page_num} exceeds detected total pages {total_pages}. Loop should have ended. Stopping.")
            break

        logging.info(
            f"--- Processing Listing Page {current_page_num} / {total_pages if total_pages > 0 else 'Dynamic'} ---")
        page_url = LISTING_URL_TEMPLATE.format(page_num=current_page_num)
        listing_html = get_listing_page_html(page_url)

        if not listing_html:
            logging.warning(f"No content fetched for listing page {current_page_num}. Skipping.")
            if total_pages == 0: consecutive_empty_listing_pages += 1
            time.sleep(random.uniform(3.0, 5.0))
            continue

        users_on_page, _ = parse_users_from_listing(listing_html)
        if not users_on_page:
            logging.info(f"No users found/parsed on listing page {current_page_num}.")
            if total_pages == 0: consecutive_empty_listing_pages += 1
            time.sleep(random.uniform(1.0, 2.0))
            continue

        if total_pages == 0: consecutive_empty_listing_pages = 0

        for user_summary in users_on_page:
            user_id = user_summary.get('user_id')
            if not user_id: logging.warning(f"Skipping user summary due to missing user_id: {user_summary}"); continue
            
            # Check if user already exists
            if str(user_id) in processed_user_ids: 
                logging.debug(f"Skipping already processed user_id: {user_id}")
                skipped_users_count += 1
                continue

            logging.info(
                f"Processing NEW User ID: {user_id}, Listing Nickname: {user_summary.get('nickname_listing', 'N/A')}")
            new_users_count += 1
            full_user_data = dict(user_summary)

            # Determine gender for photo naming
            gender_for_photo = user_summary.get('gender_listing')
            
            # Add debug logging to see what gender we got from listing
            logging.debug(f"User {user_id} - Gender from listing: {gender_for_photo}")
            
            listing_photo_url = user_summary.get('photo_url_listing')
            if listing_photo_url:
                saved_listing_photo = download_photo(listing_photo_url, user_id, photos_path, "listing_main", gender=gender_for_photo)
                full_user_data['saved_listing_photo_file'] = saved_listing_photo

            user_popup_details = fetch_and_parse_user_details(user_id)
            full_user_data.update(user_popup_details)
            
            # Update gender from popup details if available
            if user_popup_details.get('gender_popup_en'):
                gender_for_photo = user_popup_details['gender_popup_en']
            elif user_popup_details.get('gender_popup_he'):
                gender_he = user_popup_details['gender_popup_he']
                gender_for_photo = hebrew_to_english_gender(gender_he)

            popup_photo_urls = user_popup_details.get('photo_urls_popup', [])
            saved_popup_photos_files = []
            if popup_photo_urls:
                logging.info(f"Found {len(popup_photo_urls)} photo URLs in popup for user {user_id}.")
                for i, p_url in enumerate(popup_photo_urls):
                    if p_url == listing_photo_url and 'saved_listing_photo_file' in full_user_data and full_user_data[
                        'saved_listing_photo_file']:
                        logging.debug(
                            f"Popup photo {i + 1} for user {user_id} is same as listing photo. Using existing path: {full_user_data['saved_listing_photo_file']}")
                        if full_user_data['saved_listing_photo_file'] not in saved_popup_photos_files:
                            saved_popup_photos_files.append(full_user_data['saved_listing_photo_file'])
                        continue

                    # Check if already downloaded if multiple popup URLs point to same effective image
                    # (e.g. customerId=X&number=1 might be in list twice due to different relative paths resolving same)
                    # This check is a bit simplistic, relies on exact URL match after resolution.
                    # A more robust check would involve hashing filenames based on URL parameters.
                    # However, the download_photo function itself checks if file exists.

                    saved_file = download_photo(p_url, user_id, photos_path, f"popup_{i + 1}", gender=gender_for_photo)
                    if saved_file and saved_file not in saved_popup_photos_files:
                        saved_popup_photos_files.append(saved_file)
                    time.sleep(random.uniform(0.3, 0.8))
            full_user_data['saved_popup_photo_files'] = saved_popup_photos_files

            all_scraped_user_data.append(full_user_data)
            processed_user_ids.add(str(user_id))
            
            # Convert to User model format
            user_model_data = convert_to_user_model(full_user_data)
            if user_model_data:
                seed_format_users.append(user_model_data)
                logging.info(f"Successfully converted user {user_id} to User model format")

            if len(all_scraped_user_data) % 25 == 0:  # Incremental save every 25 users
                temp_json_filepath = os.path.join(OUTPUT_DIR, f"{JSON_FILENAME}.tmp")
                try:
                    with open(temp_json_filepath, 'w', encoding='utf-8') as f_tmp:
                        json.dump(all_scraped_user_data, f_tmp, indent=4, ensure_ascii=False)
                    logging.info(f"Incrementally saved {len(all_scraped_user_data)} users to {temp_json_filepath}")
                except Exception as e_json_tmp:
                    logging.error(f"Error during incremental JSON save: {e_json_tmp}")

            time.sleep(random.uniform(1.5, 3.0))  # Polite sleep between fetching each user's details

        logging.info(f"Finished processing page {current_page_num}. Sleeping before next page...")
        # Make sleep time dependent on if total_pages known, to be faster in fixed-page mode.
        sleep_between_pages = random.uniform(1.5, 3.0) if total_pages > 0 else random.uniform(2.5, 5.5)
        time.sleep(sleep_between_pages)
        if total_pages > 0 and current_page_num == total_pages:  # If it's the last known page
            logging.info(f"Reached the last detected page: {total_pages}. Stopping main page loop.")
            break

    json_filepath = os.path.join(OUTPUT_DIR, JSON_FILENAME)
    seed_json_filepath = os.path.join(OUTPUT_DIR, 'seed_users_with_photos.json')
    
    try:
        # Save original scraped data
        with open(json_filepath, 'w', encoding='utf-8') as f:
            json.dump(all_scraped_user_data, f, indent=4, ensure_ascii=False)
        logging.info(
            f"Successfully saved complete data with {len(all_scraped_user_data)} total users to '{json_filepath}'.")
        
        # Save User model formatted data
        with open(seed_json_filepath, 'w', encoding='utf-8') as f:
            json.dump(seed_format_users, f, indent=4, ensure_ascii=False)
        logging.info(
            f"Successfully saved {len(seed_format_users)} users in User model format to '{seed_json_filepath}'.")
        
        # Clean up temp files
        temp_json_filepath = os.path.join(OUTPUT_DIR, f"{JSON_FILENAME}.tmp")
        if os.path.exists(temp_json_filepath):
            try:
                os.remove(temp_json_filepath)
            except OSError:
                logging.warning(f"Could not remove temp file: {temp_json_filepath}")
    except Exception as e_json:
        logging.error(f"An error occurred during final JSON saving: {e_json}")

    logging.info(f"Scraping process completed.")
    logging.info(f"Added {new_users_count} new users, skipped {skipped_users_count} existing users.")
    logging.info(f"Total unique users now: {len(all_scraped_user_data)}")
    logging.info(f"Total users in seed format: {len(seed_format_users)}")


if __name__ == '__main__':
    main()
