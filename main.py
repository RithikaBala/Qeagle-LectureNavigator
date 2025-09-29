import os
import uuid
import json
import traceback
from typing import Dict, List
from concurrent.futures import ThreadPoolExecutor, as_completed
import subprocess

import uvicorn
import numpy as np
import yt_dlp
import whisper
from fastapi import FastAPI, BackgroundTasks, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from pymongo import MongoClient
from dotenv import load_dotenv

from langchain_huggingface import HuggingFaceEmbeddings, HuggingFacePipeline
from langchain.chains import RetrievalQA
from langchain.vectorstores import FAISS
from langchain.schema import Document
from transformers import pipeline
import torch

# ------------------- Load environment -------------------
load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
if not MONGO_URI:
    raise ValueError("MONGO_URI environment variable is not set!")

MONGO_DB = os.getenv("MONGO_DB", "test")
MONGO_COLLECTION = os.getenv("MONGO_COLLECTION", "vectors")
EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL_NAME", "all-MiniLM-L6-v2")

# ------------------- MongoDB setup -------------------
mongo_client = MongoClient(MONGO_URI)
db = mongo_client[MONGO_DB]
segments_collection = db[MONGO_COLLECTION]

try:
    segments_collection.create_index([("video_id", 1)])
    segments_collection.create_index([("text", "text")])
except Exception as e:
    print(f"Warning: Failed to create indexes: {e}")

# ------------------- Embeddings -------------------
embeddings_model = HuggingFaceEmbeddings(
    model_name=EMBEDDING_MODEL_NAME,
    model_kwargs={"device": "cpu"},
    encode_kwargs={"normalize_embeddings": True, "batch_size": 32}
)

def get_cached_embedding(text: str):
    return embeddings_model.embed_query(text)

# ------------------- Hugging Face LLM -------------------
hf_pipeline = pipeline(
    task="text-generation",
    model="google/flan-t5-small",
    device=0 if torch.cuda.is_available() else -1,
    max_new_tokens=200
)
hf_llm = HuggingFacePipeline(pipeline=hf_pipeline)

# ------------------- Load Whisper Model -------------------
whisper_model = whisper.load_model("base")

# ------------------- FastAPI setup -------------------
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

video_status: Dict[str, dict] = {}

class VideoIngestRequest(BaseModel):
    video_url: str

class RAGRequest(BaseModel):
    video_id: str
    query: str
    top_k: int = 3

# ------------------- Helper functions -------------------
def download_audio(video_url: str, output_path: str):
    temp_file = output_path.replace(".mp3", "")
    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": temp_file,
        "postprocessors": [{"key": "FFmpegExtractAudio", "preferredcodec": "mp3", "preferredquality": "192"}],
        "quiet": False,
        "no_warnings": False,
        "overwrites": True,
        "http_headers": {"User-Agent": "Mozilla/5.0"},
        "geo_bypass": True,
        "force_ipv4": True,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        result = ydl.download([video_url])
        if result != 0:
            raise RuntimeError(f"yt-dlp failed with exit code {result}")

    final_file = temp_file + ".mp3"
    if not os.path.exists(final_file):
        raise FileNotFoundError(f"Audio file not created: {final_file}")
    os.rename(final_file, output_path)

def split_audio_ffmpeg(audio_path: str, chunk_length: int = 300) -> List[str]:
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", audio_path],
        capture_output=True, text=True
    )
    duration = float(result.stdout.strip())
    chunks = []
    i = 0
    while i < duration:
        chunk_file = f"{audio_path}_chunk_{len(chunks)}.mp3"
        subprocess.run([
            "ffmpeg", "-y", "-i", audio_path,
            "-ss", str(i), "-t", str(chunk_length),
            "-c", "copy", chunk_file
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        chunks.append(chunk_file)
        i += chunk_length
    return chunks

def transcribe_chunk(chunk_path: str):
    result = whisper_model.transcribe(chunk_path)
    return result.get("segments", [])

def process_video_task(video_id: str, video_source: str):
    try:
        print(f"Processing video: {video_source}")
        audio_file = f"{video_id}.mp3"

        if os.path.exists(video_source):
            audio_file = video_source
        else:
            download_audio(video_source, audio_file)

        chunks = split_audio_ffmpeg(audio_file)
        all_segments = []
        with ThreadPoolExecutor(max_workers=4) as executor:
            futures = [executor.submit(transcribe_chunk, c) for c in chunks]
            for future in as_completed(futures):
                all_segments.extend(future.result())

        # Merge segments
        merged_segments = []
        current_text = ""
        current_start = 0
        current_end = 0
        SEGMENT_LENGTH = 30

        for seg in all_segments:
            seg_start = seg.get("start", 0.0)
            seg_end = seg.get("end", seg_start)
            seg_text = seg.get("text", "")
            if current_end - current_start >= SEGMENT_LENGTH:
                merged_segments.append({"start": current_start, "end": current_end, "text": current_text.strip()})
                current_text = seg_text
                current_start = seg_start
                current_end = seg_end
            else:
                if not current_text:
                    current_start = seg_start
                current_text += " " + seg_text
                current_end = seg_end
        if current_text:
            merged_segments.append({"start": current_start, "end": current_end, "text": current_text.strip()})

        # Insert embeddings
        texts = [seg["text"] for seg in merged_segments]
        embeddings = embeddings_model.embed_documents(texts)
        for seg, emb in zip(merged_segments, embeddings):
            segments_collection.insert_one({
                "video_id": video_id,
                "start": seg["start"],
                "end": seg["end"],
                "text": seg["text"],
                "embedding": emb
            })

        video_status[video_id]["segments"] = merged_segments
        video_status[video_id]["status"] = "completed"
        print(f"Video {video_id} processed successfully!")

    except Exception as e:
        video_status[video_id]["status"] = "failed"
        video_status[video_id]["error"] = f"{str(e)}\n{traceback.format_exc()}"
        print("ERROR:", e)

# ------------------- API Endpoints -------------------
@app.post("/ingest_video")
async def ingest_video(req: VideoIngestRequest, background_tasks: BackgroundTasks):
    video_id = str(uuid.uuid4())
    video_status[video_id] = {"status": "processing", "segments": []}
    background_tasks.add_task(process_video_task, video_id, req.video_url)
    return {"video_id": video_id, "status": "processing"}

@app.post("/ingest_file")
async def ingest_file(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    video_id = str(uuid.uuid4())
    video_status[video_id] = {"status": "processing", "segments": []}
    temp_path = f"{video_id}_{file.filename}"
    with open(temp_path, "wb") as f:
        f.write(await file.read())
    background_tasks.add_task(process_video_task, video_id, temp_path)
    return {"video_id": video_id, "status": "processing"}

@app.get("/status")
async def get_status(video_id: str):
    if video_id not in video_status:
        return {"error": "Video ID not found"}
    return video_status[video_id]

@app.post("/rag_hf")
async def rag_search(req: RAGRequest):
    if req.video_id not in video_status:
        raise HTTPException(status_code=404, detail="Video ID not found")
    if video_status[req.video_id]["status"] != "completed":
        raise HTTPException(status_code=400, detail=f"Video still {video_status[req.video_id]['status']}")

    all_segments = list(segments_collection.find({"video_id": req.video_id}))
    if not all_segments:
        return {"segments": [], "answer": "No content available for this video."}

    query_vector = np.array(get_cached_embedding(req.query))
    query_norm = np.linalg.norm(query_vector)
    results = []
    for seg in all_segments:
        if "embedding" not in seg: continue
        seg_vector = np.array(seg["embedding"])
        seg_norm = np.linalg.norm(seg_vector)
        score = float(np.dot(seg_vector, query_vector) / (seg_norm * query_norm + 1e-10))
        results.append({"text": seg.get("text", ""), "start": seg.get("start", 0), "end": seg.get("end", 0), "score": score})

    results = sorted(results, key=lambda x: x["score"], reverse=True)[:3]

    docs = [Document(page_content=r["text"]) for r in results]
    vectorstore = FAISS.from_documents(docs, embeddings_model)
    retriever = vectorstore.as_retriever()

    try:
        rag_chain = RetrievalQA.from_chain_type(
            llm=hf_llm,
            chain_type="stuff",
            retriever=retriever,
            return_source_documents=False
        )
        answer = rag_chain.run(req.query)
    except Exception as e:
        answer = f"RAG processing failed: {str(e)}"

    return {"segments": results, "answer": answer}

@app.get("/download_transcript")
async def download_transcript(video_id: str):
    if video_id not in video_status or "segments" not in video_status[video_id]:
        return {"error": "Video not found or not processed"}
    segments = video_status[video_id]["segments"]
    transcript_path = f"{video_id}_transcript.txt"
    with open(transcript_path, "w", encoding="utf-8") as f:
        for seg in segments:
            f.write(f"{seg['start']} - {seg['end']}\n{seg['text']}\n\n")
    return FileResponse(transcript_path, filename="transcript.txt", media_type="text/plain")

@app.get("/")
async def root():
    return {"message": "Lecture Navigator Backend is running."}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)


