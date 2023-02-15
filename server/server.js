console.log('started');
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { Storage } = require('@google-cloud/storage');
const speech = require('@google-cloud/speech');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = process.env.PORT || 3001;
const storage = new Storage();
const bucketName = 'podcast-summary-bucket';
const bucket = storage.bucket(bucketName);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Multer configuration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 60 * 1024 * 1024, // limit to 50 MB
  },
});

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });

// Route for uploading audio file
app.post('/api/upload', upload.single('audio'), async (req, res) => {
  try {
    // Check if a file was uploaded
    if (!req.file) {
      res.status(400).send('No file uploaded');
      return;
    }

    // Upload audio file to GCS bucket
    // const fileUrl = await uploadAudioFile(req.file.buffer);

    // Transcribe audio file using Google Cloud Speech-to-Text API
    const transcription = await transcribeAudioFile(req.file.buffer);

    // Summarize text using GPT API
    const summary = await summarizeText(transcription);

    // Return summary to client
    res.send({ summary });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal server error');
  }
});

// app.get('/',async(req, res) =>{
//     res.send('Hello');
// })

// Uploads the audio file to a GCS bucket and returns the public URL of the file
async function uploadAudioFile(audioBuffer) {
  const fileName = `${uuidv4()}.mp3`;
  const file = bucket.file(fileName);
  const fileOptions = {
    resumable: false,
    metadata: {
      contentType: 'audio/mp3',
    },
  };
  await file.save(audioBuffer, fileOptions);
  return `https://storage.googleapis.com/${bucketName}/${fileName}`;
}

// Transcribes the audio file using the Google Cloud Speech-to-Text API and returns the transcription
async function transcribeAudioFile(audioBuffer) {
  const client = new speech.SpeechClient();
  const audio = {
    content: audioBuffer.toString('base64'),
  };
  const config = {
    encoding: 'MP3',
    sampleRateHertz: 44100,
    languageCode: 'en-US',
  };
  const request = {
    audio: audio,
    config: config,
  };
  const [response] = await client.recognize(request);
  const transcription = response.results
    .map(result => result.alternatives[0].transcript)
    .join('\n');
  return transcription;
}

async function summarizeText(apiKey, text, numSentences) {
    try {
      const openaiApi = new openai(apiKey);
  
      const prompt = `Summarize the following text in ${numSentences} sentences:\n\n${text}`;
      const completions = await openaiApi.complete({
        engine: 'text-davinci-002',
        prompt: prompt,
        maxTokens: 1024,
        n: 1,
        stop: '\n\n',
      });
  
      return completions.choices[0].text.trim();
    } catch (error) {
      console.error(error);
      throw new Error('Failed to summarize text');
    }
  }
