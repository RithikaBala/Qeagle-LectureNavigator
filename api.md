GET /health


**Description:**  
Checks if the backend server is running.

**Response:**
```json
{
  "status": "ok",
  "message": "Server is healthy"
}

POST /upload

{
  "video_url": "https://www.youtube.com/watch?v=abc123"
}

{
  "video_id": "uuid-generated-id",
  "status": "processing",
  "message": "Video download and transcription started"
}

GET /status/{video_id}

{
  "video_id": "uuid-generated-id",
  "status": "transcribing",
  "progress": 45
}

{
  "video_id": "uuid-generated-id",
  "status": "completed",
  "transcript_segments": 128
}

POST /rag_hf

{
  "video_id": "uuid-generated-id",
  "question": "What is backpropagation in neural networks?"
}

{
  "video_id": "uuid-generated-id",
  "question": "What is backpropagation in neural networks?",
  "rag_answer": "Backpropagation is the algorithm used to adjust weights in a neural network by propagating the error backwards...",
  "top_segments": [
    {
      "text": "Backpropagation helps in minimizing loss by updating weights.",
      "score": 0.89
    },
    {
      "text": "It computes gradients using the chain rule.",
      "score": 0.78
    }
  ]
}

GET /transcript/{video_id}

{
  "video_id": "uuid-generated-id",
  "transcript": [
    { "start": "00:00:05", "end": "00:00:15", "text": "Welcome to the lecture on deep learning..." },
    { "start": "00:00:16", "end": "00:00:25", "text": "We will first cover the basics of neural networks..." }
  ]
}
