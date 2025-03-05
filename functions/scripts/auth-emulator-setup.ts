import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  connectAuthEmulator, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut
} from "firebase/auth";
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Your Firebase configuration - this should match your project
const firebaseConfig = {
  apiKey: process.env.APP_API_KEY,
  authDomain: process.env.APP_AUTH_DOMAIN,
  projectId: process.env.APP_PROJECT_ID,
  // The rest is not needed for the emulator
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Connect to the Auth emulator
connectAuthEmulator(auth, "http://127.0.0.1:9099");

async function setupTestUser() {
  try {
    // Test user credentials
    const email = "test@example.com";
    const password = "testpassword123";
    
    console.log(`Setting up test user: ${email}`);
    
    try {
      // First, try to create a new user
      await createUserWithEmailAndPassword(auth, email, password);
      console.log("User created successfully");
    } catch (error: any) {
      // If the user already exists, that's fine
      if (error.code === "auth/email-already-in-use") {
        console.log("User already exists");
      } else {
        throw error;
      }
    }
    
    // Sign in to get the ID token
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Get the ID token
    const idToken = await user.getIdToken();
    console.log("\n--- Authentication Token ---");
    console.log(idToken);
    console.log("\nUse this token in your test-curl.sh script:");
    console.log(`AUTH_TOKEN="${idToken}"`);
    
    // Sign out
    await signOut(auth);
    console.log("\nUser signed out");
  } catch (error) {
    console.error("Error setting up test user:", error);
  }
}

// Run the function
setupTestUser(); 