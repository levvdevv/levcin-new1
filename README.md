# Firestore Chat App

Real-time chat application menggunakan Firebase Firestore.

## Setup Firebase

1. Buat project baru di [Firebase Console](https://console.firebase.google.com/)
2. Aktifkan Firestore Database
3. Aktifkan Firebase Storage
4. Copy konfigurasi Firebase ke `src/config/firebase.ts`

### Firestore Rules

Buat rules berikut di Firestore:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Messages collection
    match /messages/{messageId} {
      allow read, write: if true; // Untuk demo, dalam production gunakan auth
    }
    
    // Users collection
    match /users/{userId} {
      allow read, write: if true; // Untuk demo, dalam production gunakan auth
    }
  }
}
```

### Storage Rules

Buat rules berikut di Firebase Storage:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /uploads/{allPaths=**} {
      allow read, write: if true; // Untuk demo, dalam production gunakan auth
    }
  }
}
```

## Cara Setup

1. Clone repository
2. Install dependencies: `npm install`
3. Update konfigurasi Firebase di `src/config/firebase.ts`
4. Jalankan development server: `npm run dev`
5. Build untuk production: `npm run build`

## Deploy ke Vercel

1. Push ke GitHub
2. Connect repository ke Vercel
3. Deploy otomatis akan berjalan

## Fitur

- ✅ Real-time messaging dengan Firestore
- ✅ File upload dengan Firebase Storage
- ✅ Emoji picker
- ✅ GIF support
- ✅ Message editing dan deletion
- ✅ Read receipts
- ✅ Typing indicators
- ✅ Online status
- ✅ Message search
- ✅ Drag & drop file upload
- ✅ Responsive design
- ✅ Video call UI (demo)

## Login Credentials

- Username: `lev`, Password: `lev`
- Username: `cin`, Password: `cin`