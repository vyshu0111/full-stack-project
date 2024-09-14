const express = require('express');
const firebase = require('firebase-admin');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Initialize Firebase (you'll need to add your own credentials)
const serviceAccount = require('./serviceAccountKey.json');
firebase.initializeApp({
  credential: firebase.credential.cert(serviceAccount),
  databaseURL: "https://full-stack-ade17-default-rtdb.asia-southeast1.firebasedatabase.app"
});

const db = firebase.firestore();

app.use(bodyParser.json());
app.use(cors());

// Serve static files from the frontend directory
app.use(express.static(path.join(__dirname, '../frontend')));

// Route for the home page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/login-registration.html'));
});

// Route for the session request page
app.get('/session-request', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/session-request.html'));
});

// Route for the counselor dashboard
app.get('/counselor-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/counselor-dashboard.html'));
});

// User registration
app.post('/api/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !/^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    const user = await firebase.auth().createUser({
      email,
      password,
      displayName: name,
    });
    await db.collection('users').doc(user.uid).set({
      name,
      email,
      
    });
    res.status(201).json({ message: 'User registered successfully', userId: user.uid });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// User login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if email format is correct
    if (!email || !/^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const userRecord = await firebase.auth().getUserByEmail(email);
    
    // In a real-world scenario, you should use Firebase Authentication to verify the password
    // For this example, we're just checking if the user exists
    const userDoc = await db.collection('users').doc(userRecord.uid).get();
    const userData = userDoc.data();

    if (userData) {
      res.status(200).json({ 
        message: 'Login successful', 
        
      });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});


const verifyToken = async (req, res, next) => {
  const idToken = req.headers.authorization;
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized' });
  }
};
// Session request
app.post('/api/session-request', async (req, res) => {
  try {
    const { name, email, counsellingType, preferredDate, preferredTime, description } = req.body;

    // If the studentId and counselorId are necessary, ensure they are provided. Here I am assuming these fields are not mandatory for this form.
    const sessionRef = await db.collection('vyshu').add({
      name,
      email,
      type: counsellingType,
      date: preferredDate,
      time: preferredTime,
      description,
      status: 'requested',
    });

    res.status(201).json({ message: 'Session requested successfully', sessionId: sessionRef.id });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/counselor-sessions', verifyToken, async (req, res) => {
  try {
    const sessionsSnapshot = await db.collection('vyshu')
      .where('status', 'in', ['requested', 'approved'])
      .get();
    const sessions = [];
    sessionsSnapshot.forEach(doc => {
      sessions.push({ 
        id: doc.id, 
        studentName: doc.data().name,
        date: doc.data().date,
        time: doc.data().time,
        type: doc.data().type,
        status: doc.data().status,
        notes: doc.data().notes || ""
      });
    });
    res.status(200).json(sessions);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get session details
app.get('/api/session/:sessionId', verifyToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const sessionDoc = await db.collection('vyshu').doc(sessionId).get();
    if (!sessionDoc.exists) {
      res.status(404).json({ error: 'Session not found' });
    } else {
      const sessionData = sessionDoc.data();
      res.status(200).json({ 
        id: sessionDoc.id, 
        studentName: sessionData.name,
        date: sessionData.date,
        time: sessionData.time,
        type: sessionData.type,
        status: sessionData.status,
        notes: sessionData.notes || "",
        description: sessionData.description
      });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update session status
app.put('/api/session/:sessionId', verifyToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { status, notes } = req.body;
    await db.collection('vyshu').doc(sessionId).update({ status, notes });
    res.status(200).json({ message: 'Session updated successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});