// lib/firebaseAdmin.ts
import admin from 'firebase-admin';
import { getFirestore, Firestore } from 'firebase-admin/firestore'; // Import Firestore type
import { getAuth, Auth } from 'firebase-admin/auth'; // Import Auth type

// Declare variables to hold the initialized instances
let firestore: Firestore | null = null;
let adminAuth: Auth | null = null;
let initError: Error | null = null; // Store initialization error

console.log("Attempting Firebase Admin SDK Initialization...");

try {
    // Check if the environment variable is set (optional but good practice)
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
         console.warn("⚠️ GOOGLE_APPLICATION_CREDENTIALS environment variable is not set. Firebase Admin SDK might rely on default credentials if available (e.g., on Google Cloud Run/Functions), or fail.");
         // You might throw an error here if the variable is absolutely required for your environment
         // throw new Error("GOOGLE_APPLICATION_CREDENTIALS is not set.");
    }

    // Initialize only if no apps are already initialized
    if (admin.apps.length === 0) {
        // When GOOGLE_APPLICATION_CREDENTIALS environment variable is set,
        // initializeApp() without arguments reads it automatically.
        admin.initializeApp();
        console.log("✅ Firebase Admin SDK Initialized successfully.");
    } else {
         // If already initialized (e.g., due to hot-reloading in dev), get the default app
         console.log("ℹ️ Firebase Admin SDK already initialized. Getting default app.");
         // Ensure we still try to get instances even if app was already initialized
    }

    // Get Firestore and Auth instances from the initialized app
    firestore = getFirestore();
    adminAuth = getAuth();

    // Verify instances were obtained
    if (!firestore) {
         throw new Error("Failed to get Firestore instance after initialization.");
    }
     if (!adminAuth) {
         throw new Error("Failed to get Auth instance after initialization.");
     }

    console.log("Firestore and AdminAuth instances obtained.");

} catch (error: any) {
    // Catch and store initialization errors
    initError = error; // Store the error
    console.error("❌ Firebase Admin SDK Initialization Failed:", error.message);
    // Log the stack trace for more details during debugging
    if (error.stack) {
        console.error("Stack Trace:", error.stack);
    }
    // Keep firestore and adminAuth as null if initialization fails
    firestore = null;
    adminAuth = null;
}

// Export the instances (they will be null if initialization failed)
// Also exporting the error allows API routes to check if init failed explicitly
export { firestore, adminAuth, initError };