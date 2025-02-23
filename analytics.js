// Your web app's Firebase configuration
const firebaseConfig = {
    // Get these values from your Firebase console
    apiKey: "AIzaSyC9gN9sztVOhhEF08Nw9swyhpMgDIWbKc4",
    authDomain: "ahmeds-portfolio.firebaseapp.com",
    databaseURL: "https://ahmeds-portfolio-default-rtdb.firebaseio.com",
    projectId: "ahmeds-portfolio",
    storageBucket: "ahmeds-portfolio.firebasestorage.app",
    messagingSenderId: "575033608962",
    appId: "1:575033608962:web:daa7c529ba495b2fbc501b",
    measurementId: "G-V5VQE52RGM"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const analytics = firebase.analytics();
const database = firebase.database();

// Record visit with error handling
function recordVisit() {
    try {
        const visitData = {
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            language: navigator.language,
            screenResolution: `${window.screen.width}x${window.screen.height}`,
            referrer: document.referrer || 'direct',
            pathname: window.location.pathname
        };

        // Add to Firebase Database
        database.ref('visits').push(visitData)
            .then(() => console.log('Visit recorded successfully'))
            .catch(error => console.error('Error recording visit:', error));
        
        // Log event to Analytics
        analytics.logEvent('page_view', visitData);
    } catch (error) {
        console.error('Error in recordVisit:', error);
    }
}

// Record visit when page loads
document.addEventListener('DOMContentLoaded', recordVisit);

// Test connection
console.log('Firebase Analytics initialized:', !!analytics);
console.log('Firebase Database initialized:', !!database); 