# 🎥 Lecture Navigator

A web application that allows you to **upload or link to a lecture video**, automatically **transcribe** it into text, and then use **AI-powered search (RAG)** to answer questions based on the video content.

---

## 🚀 Features

✅ Download audio from YouTube links using `yt-dlp`  
✅ Transcribe audio into text using **Whisper**  
✅ Split transcript into smaller segments for efficient search  
✅ Generate **vector embeddings** and store them in **MongoDB**  
✅ Perform **semantic search** to retrieve relevant transcript segments  
✅ Generate AI-powered answers using **Retrieval-Augmented Generation (RAG)**  
✅ Download transcript as a `.txt` file  
✅ Full **React + FastAPI** stack with REST APIs  

---

## 🛠 Tech Stack

- **Frontend:** React, TailwindCSS, React Router
- **Backend:** FastAPI (Python), Uvicorn
- **Database:** MongoDB (for storing transcript + embeddings)
- **AI Models:**
  - OpenAI Whisper (for transcription)
  - HuggingFace Embeddings (`all-MiniLM-L6-v2`)
  - HuggingFace Flan-T5 (for RAG answer generation)
- **Other Tools:**
  - yt-dlp (download YouTube audio)
  - FAISS (vector similarity search)

---

## 📂 Project Structure

```bash
lecture-project/
│
├── backend/                 # FastAPI backend
│   ├── main.py              # Entry point for API server
│   ├── requirements.txt     # Python dependencies
│   └── ...
│
├── frontend/                # React frontend
│   ├── src/
│   │   ├── App.jsx          # Main React component
│   │   ├── pages/           # ResultsPage, UploadPage etc.
│   │   └── ...
│   └── package.json
│
└── README.md                # You are here
