const firebaseConfig = {
    apiKey: "AIzaSyDYX0H5rDvauYt9PyZhWMfK4SPPyP-_JmE",
    authDomain: "helpdesk-central-74dd0.firebaseapp.com",
    projectId: "helpdesk-central-74dd0",
    storageBucket: "helpdesk-central-74dd0.firebasestorage.app",
    messagingSenderId: "857472145160",
    appId: "1:857472145160:web:2b182ab5cecba6babf7ebd",
    measurementId: "G-XL2YKYQF5G"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Cloudinary Configuration
const CLOUDINARY_CLOUD_NAME = 'drr9n9o4z';
const CLOUDINARY_UPLOAD_PRESET = 'helpdesk_central_media';

function isAllowedUpload(file) {
  var allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  if (allowedTypes.indexOf(file.type) !== -1) return true;
  var ext = (file.name.split('.').pop() || '').toLowerCase();
  return ['jpg', 'jpeg', 'png'].indexOf(ext) !== -1;
}

const PAYSTACK_PUBLIC_KEY = 'pk_live_6676da57ead3b9eb170ac1f17fbffdfe1b14ca96';
const APPLICATION_FEE_UNIVERSITY = 100;
const APPLICATION_FEE_COLLEGE = 60;

const GEMINI_API_KEY = 'AIzaSyAQ.Ab8RN6JJwt_4963BkohhqwHGrUn9RAO5aUaupq2XrX7IzNVmdw';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

const VAPID_PUBLIC_KEY = 'BE60YalCtNXTwCFfIpuxJ3AsMqGQhlZzblYeCOLJym2PH0i00TsjOTmuRkw0s62DoU4ioDmY15BDUrpPmY36ezc';

// === Firestore Read Cache ===
var CACHE_TTL = 2 * 60 * 1000; // 2 minutes
var FIRESTORE_CACHE = {};

function getCachedDoc(docPath) {
    try {
        var entry = FIRESTORE_CACHE[docPath];
        if (!entry) {
            var raw = localStorage.getItem('fs_cache_' + docPath);
            if (!raw) return null;
            entry = JSON.parse(raw);
            if (Date.now() - entry.ts > CACHE_TTL) return null;
            FIRESTORE_CACHE[docPath] = entry;
            return entry.data;
        }
        if (Date.now() - entry.ts > CACHE_TTL) {
            delete FIRESTORE_CACHE[docPath];
            return null;
        }
        return entry.data;
    } catch(e) { 
        return null; 
    }
}

function setCachedDoc(docPath, data) {
    try {
        var entry = { ts: Date.now(), data: data };
        FIRESTORE_CACHE[docPath] = entry;
        localStorage.setItem('fs_cache_' + docPath, JSON.stringify(entry));
    } catch(e) {}
}

function invalidateCache(docPath) {
    try {
        if (docPath) {
            delete FIRESTORE_CACHE[docPath];
            localStorage.removeItem('fs_cache_' + docPath);
        } else {
            FIRESTORE_CACHE = {};
            for (var i = 0; i < localStorage.length; i++) {
                var k = localStorage.key(i);
                if (k && k.indexOf('fs_cache_') === 0) {
                    localStorage.removeItem(k);
                }
            }
        }
    } catch(e) {}
}

function cachedDocGet(collection, docId, forceFresh) {
    var path = collection + '/' + docId;
    if (forceFresh) {
        invalidateCache(path);
        return db.collection(collection).doc(docId).get().then(function(doc) {
            if (doc.exists) setCachedDoc(path, doc.data());
            return doc;
        });
    }
    var cached = getCachedDoc(path);
    if (cached !== null) {
        return Promise.resolve({ exists: true, data: function() { return cached; }, id: docId });
    }
    return db.collection(collection).doc(docId).get().then(function(doc) {
        if (doc.exists) setCachedDoc(path, doc.data());
        return doc;
    });
}

function cachedQueryGet(collection, field, op, value) {
    var path = collection + '_' + field + '_' + op + '_' + value;
    var cached = getCachedDoc(path);
    if (cached !== null) {
        return Promise.resolve({ 
            forEach: function(cb) {
                cached.forEach(function(item) {
                    cb({ data: function() { return item.d || item; }, id: item.i || null });
                });
            }, 
            empty: cached.length === 0, 
            size: cached.length 
        });
    }
    return db.collection(collection).where(field, op, value).get().then(function(snap) {
        var arr = [];
        snap.forEach(function(d) {
            arr.push({ d: d.data(), i: d.id });
        });
        setCachedDoc(path, arr);
        return snap;
    });
}

function uploadToCloudinary(file, folder) {
    if (!CLOUDINARY_CLOUD_NAME || CLOUDINARY_CLOUD_NAME === 'your_cloud_name_here') {
        return Promise.reject(new Error('Cloudinary not configured. Update firebase-config.js with your Cloudinary credentials.'));
    }
    var formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    if (folder) formData.append('folder', folder);
    
    var url = 'https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD_NAME + '/auto/upload';
    
    return fetch(url, {
        method: 'POST',
        body: formData
    }).then(function(response) {
        return response.json();
    }).then(function(data) {
        if (data.error) throw new Error(data.error.message);
        return data.secure_url;
    });
}

function uploadToFirebase(file, folder) {
    var ref = storage.ref(folder + '/' + Date.now() + '_' + file.name);
    return ref.put(file).then(function(snapshot) {
        return snapshot.ref.getDownloadURL();
    });
}
