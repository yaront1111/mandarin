# Internationalization Conventions

This document outlines the standardized conventions for internationalization (i18n) in the Mandarin application.

## Key Naming Conventions

Translation keys in the application should follow these conventions:

1. **Dot Notation**: Use dot notation for hierarchical relationships
   - Example: `profile.photos.privateAccess` instead of `profile_photos_privateAccess`

2. **Namespaces**: Use consistent namespaces as the first segment of the key
   - Common namespaces:
     - `common`: For shared UI elements and generic text across the app
     - `profile`: For user profile related content
     - `auth`: For authentication related content
     - `messages`: For chat/messaging related content
     - `dashboard`: For dashboard related content
     - `settings`: For settings related content
     - `subscription`: For subscription related content
     - `stories`: For stories feature related content
     - `errors`: For error messages

3. **Casing**: 
   - Use camelCase for key segments (e.g., `profile.profilePhoto`, not `profile.profile_photo`)
   - Exception: For enumeration values, use snake_case (e.g., `profile.maritalStatus.in_relationship`)

4. **Key Segments**:
   - Feature area (e.g., `profile`, `auth`)
   - UI section/component (e.g., `photos`, `form`, `settings`)
   - Specific element/action (e.g., `deleteButton`, `saveSuccess`, `errorMessage`)

5. **Nested Object Structure**:
   ```json
   {
     "profile": {
       "photos": {
         "privateAccess": "Request private photo access",
         "uploadButton": "Upload photo"
       }
     }
   }
   ```

## Translation Function Usage

When accessing translations in components:

1. **Basic Usage**: 
   ```jsx
   const { t } = useTranslation();
   t('profile.photos.uploadButton');
   ```

2. **With Variables**:
   ```jsx
   t('profile.greeting', { name: user.name });
   // "Hello, {{name}}!" -> "Hello, John!"
   ```

3. **Handling Missing Keys**:
   - Always use the dot notation format
   - The application will provide a fallback if the key is missing

4. **Shared Utility Function**:
   - Use the `translate` utility function for consistent access patterns:
   ```jsx
   import { translate } from '../utils/i18n';
   translate('profile.photos.uploadButton', t, 'Default text');
   ```

## Migration Strategy

When migrating from old translation keys to the new system:

1. Always use the new dot notation format in new code
2. Use the `translate` utility function which handles both old and new formats
3. Update old keys to new format as you encounter them
4. Document special cases in comments