
# """
# Main application entry point.
# Uses yt_dlp + Whisper for transcription instead of langchain_community.
# """
# import os
# import uuid
# import json
# import traceback
# import asyncio
# from functools import lru_cache
# from typing import Dict

# import uvicorn
# import numpy as np
# import yt_dlp
# import whisper
# from fastapi import FastAPI, BackgroundTasks, UploadFile, File
# from fastapi.middleware.cors import CORSMiddleware
# from fastapi.responses import FileResponse, StreamingResponse
# from pydantic import BaseModel
# from pymongo import MongoClient
# from dotenv import load_dotenv
# from langchain_huggingface import HuggingFaceEmbeddings

# # ------------------- Load environment -------------------
# load_dotenv()

# MONGO_URI = os.getenv("MONGO_URI")
# if not MONGO_URI:
#     raise ValueError("MONGO_URI environment variable is not set!")

# MONGO_DB = os.getenv("MONGO_DB", "test")
# MONGO_COLLECTION = os.getenv("MONGO_COLLECTION", "vectors")
# EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL_NAME", "all-MiniLM-L6-v2")
# HF_API_KEY = os.getenv("HUGGINGFACE_API_KEY")
# if not HF_API_KEY:
#     raise ValueError("HUGGINGFACE_API_KEY environment variable is not set!")

# # ------------------- MongoDB setup -------------------
# mongo_client = MongoClient(
#     MONGO_URI,
#     maxPoolSize=50,
#     minPoolSize=10,
#     maxIdleTimeMS=45000,
#     connectTimeoutMS=20000,
#     retryWrites=True,
#     serverSelectionTimeoutMS=30000
# )
# db = mongo_client[MONGO_DB]
# segments_collection = db[MONGO_COLLECTION]

# # Create indexes
# try:
#     segments_collection.create_index([("video_id", 1)])
#     segments_collection.create_index([("embedding", 1)])
#     segments_collection.create_index([("text", "text")])
# except Exception as e:
#     print(f"Warning: Failed to create indexes: {e}")

# # ------------------- Embeddings -------------------
# embeddings_model = HuggingFaceEmbeddings(
#     model_name=EMBEDDING_MODEL_NAME,
#     model_kwargs={"device": "cpu"},
#     encode_kwargs={"normalize_embeddings": True, "batch_size": 32}
# )

# @lru_cache(maxsize=1000)
# def get_cached_embedding(text):
#     return embeddings_model.embed_query(text)

# # ------------------- Load Whisper Model Once -------------------
# whisper_model = whisper.load_model("base")

# # ------------------- FastAPI setup -------------------
# app = FastAPI()
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],  # Adjust for your frontend
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# # ------------------- In-memory video status -------------------
# video_status: Dict[str, dict] = {}

# # ------------------- Request Models -------------------
# class VideoIngestRequest(BaseModel):
#     video_url: str

# class SearchRequest(BaseModel):
#     video_id: str
#     query: str
#     top_k: int = 3

# # ------------------- Helper functions -------------------
# def download_audio(video_url: str, output_path: str):
#     temp_file = output_path.replace(".mp3", "")
#     ydl_opts = {
#         "format": "bestaudio/best",
#         "outtmpl": temp_file,
#         'cookiefile': 'cookies.txt',
#         "postprocessors": [{
#             "key": "FFmpegExtractAudio",
#             "preferredcodec": "mp3",
#             "preferredquality": "192",
#         }],
#         "quiet": False,
#         "no_warnings": False,
#         "overwrites": True,
#         "http_headers": {
#             "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
#                           "AppleWebKit/537.36 (KHTML, like Gecko) "
#                           "Chrome/122.0.0.0 Safari/537.36"
#         },
#         "geo_bypass": True,
#         'force_ipv4': True,

#     }
#     with yt_dlp.YoutubeDL(ydl_opts) as ydl:
#         result = ydl.download([video_url])
#         if result != 0:
#             raise RuntimeError(f"yt-dlp failed with exit code {result}")

#     final_file = temp_file + ".mp3"
#     if not os.path.exists(final_file):
#         raise FileNotFoundError(f"Audio file was not created: {final_file}")
#     os.rename(final_file, output_path)
#     print(f"[INFO] Audio saved to {output_path}")

# def transcribe_audio(audio_path: str):
#     result = whisper_model.transcribe(audio_path)
#     segments = []
#     for seg in result.get("segments", []):
#         segments.append({
#             "start": seg.get("start", 0.0),
#             "end": seg.get("end", seg.get("start", 0.0)+3.0),
#             "text": seg.get("text", "")
#         })
#     return segments

# def process_video_task(video_id: str, video_source: str):
#     try:
#         print(f"Processing video: {video_source}")
#         audio_file = f"{video_id}.mp3"

#         # Determine if video_source is a URL or local file
#         if os.path.exists(video_source):
#             audio_file = video_source  # uploaded file
#         else:
#             download_audio(video_source, audio_file)

#         # Transcribe audio
#         segments = transcribe_audio(audio_file)

#         # Generate embeddings
#         texts = [seg["text"] for seg in segments]
#         embeddings = embeddings_model.embed_documents(texts)

#         # Save segments to MongoDB
#         for seg, embedding in zip(segments, embeddings):
#             doc = {
#                 "video_id": video_id,
#                 "start": seg["start"],
#                 "end": seg["end"],
#                 "text": seg["text"],
#                 "embedding": embedding
#             }
#             segments_collection.insert_one(doc)

#         # Update in-memory status
#         video_status[video_id]["segments"] = segments
#         video_status[video_id]["status"] = "completed"
#         print(f"Video {video_id} processed successfully!")

#     except Exception as e:
#         error_message = f"{str(e)}\n{traceback.format_exc()}"
#         print("ERROR while processing video:", error_message)
#         video_status[video_id]["status"] = "failed"
#         video_status[video_id]["error"] = error_message

# # ------------------- API Endpoints -------------------
# @app.post("/ingest_video")
# async def ingest_video(req: VideoIngestRequest, background_tasks: BackgroundTasks):
#     video_id = str(uuid.uuid4())
#     video_status[video_id] = {"status": "processing", "segments": []}
#     background_tasks.add_task(process_video_task, video_id, req.video_url)
#     return {"video_id": video_id, "status": "processing"}

# @app.post("/ingest_file")
# async def ingest_file(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
#     video_id = str(uuid.uuid4())
#     video_status[video_id] = {"status": "processing", "segments": []}
#     temp_path = f"{video_id}_{file.filename}"
#     with open(temp_path, "wb") as f:
#         f.write(await file.read())
#     background_tasks.add_task(process_video_task, video_id, temp_path)
#     return {"video_id": video_id, "status": "processing"}

# @app.get("/status")
# async def get_status(video_id: str):
#     if video_id not in video_status:
#         return {"error": "Video ID not found"}
#     return video_status[video_id]

# @app.post("/search")
# async def search_video(req: SearchRequest):
#     if req.video_id not in video_status:
#         return {"error": "Video ID not found"}
#     if video_status[req.video_id]["status"] != "completed":
#         return {"error": f"Video is still {video_status[req.video_id]['status']}"}

#     query_vector = np.array(get_cached_embedding(req.query))
#     query_norm = np.linalg.norm(query_vector)
#     all_segments = list(segments_collection.find({"video_id": req.video_id}))
#     if not all_segments:
#         return {"results": []}

#     results = []
#     for seg in all_segments:
#         if "embedding" not in seg:
#             continue
#         seg_vector = np.array(seg["embedding"])
#         seg_norm = np.linalg.norm(seg_vector)
#         score = float(np.dot(seg_vector, query_vector) / (seg_norm * query_norm + 1e-10))
#         results.append({
#             "_id": str(seg["_id"]),
#             "text": seg.get("text", ""),
#             "start": seg.get("start", 0),
#             "end": seg.get("end", 0),
#             "score": score
#         })

#     results = sorted(results, key=lambda x: x["score"], reverse=True)[:req.top_k]
#     return {"results": results}

# @app.get("/search_stream")
# async def search_stream(video_id: str, query: str, top_k: int = 3):
#     if video_id not in video_status:
#         return {"error": "Video ID not found"}
#     if video_status[video_id]["status"] != "completed":
#         return {"error": f"Video is still {video_status[video_id]['status']}"}

#     query_vector = np.array(get_cached_embedding(query))
#     query_norm = np.linalg.norm(query_vector)
#     all_segments = list(segments_collection.find({"video_id": video_id}))

#     async def event_generator():
#         scored_segments = []
#         for seg in all_segments:
#             if "embedding" not in seg:
#                 continue
#             seg_vector = np.array(seg["embedding"])
#             seg_norm = np.linalg.norm(seg_vector)
#             score = float(np.dot(seg_vector, query_vector) / (seg_norm * query_norm + 1e-10))
#             scored_segments.append({
#                 "t_start": seg.get("start", 0),
#                 "t_end": seg.get("end", 0),
#                 "snippet": seg.get("text", ""),
#                 "score": score
#             })

#         scored_segments = sorted(scored_segments, key=lambda x: x["score"], reverse=True)[:top_k]
#         for seg in scored_segments:
#             yield f"data: {json.dumps(seg)}\n\n"
#             await asyncio.sleep(0.05)

#     return StreamingResponse(event_generator(), media_type="text/event-stream")

# @app.get("/download_transcript")
# async def download_transcript(video_id: str):
#     if video_id not in video_status or "segments" not in video_status[video_id]:
#         return {"error": "Video not found or not processed"}
#     segments = video_status[video_id]["segments"]
#     transcript_path = f"{video_id}_transcript.txt"
#     with open(transcript_path, "w", encoding="utf-8") as f:
#         for seg in segments:
#             f.write(f"{seg['start']} - {seg['end']}\n{seg['text']}\n\n")
#     return FileResponse(transcript_path, filename="transcript.txt", media_type="text/plain")

# @app.get("/")
# async def root():
#     return {"message": "Lecture Navigator Backend is running."}

# @app.get("/favicon.ico")
# async def favicon():
#     return {}

# # ------------------- Run Uvicorn -------------------
# if __name__ == "__main__":
#     uvicorn.run(app, host="0.0.0.0", port=8001, reload=True)
import os
import uuid
import json
import traceback
import asyncio
from functools import lru_cache
from typing import Dict, List

import uvicorn
import yt_dlp
from fastapi import FastAPI, BackgroundTasks, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from pymongo import MongoClient
from dotenv import load_dotenv
from langchain_huggingface import HuggingFaceEmbeddings
from faster_whisper import WhisperModel
from concurrent.futures import ThreadPoolExecutor

# ------------------- Load environment -------------------
load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB = os.getenv("MONGO_DB", "test")
MONGO_COLLECTION = os.getenv("MONGO_COLLECTION", "vectors")
EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL_NAME", "all-MiniLM-L6-v2")
HF_API_KEY = os.getenv("HUGGINGFACE_API_KEY")

# ------------------- MongoDB setup -------------------
mongo_client = MongoClient(MONGO_URI)
db = mongo_client[MONGO_DB]
segments_collection = db[MONGO_COLLECTION]

# Create indexes
segments_collection.create_index([("video_id", 1)])
segments_collection.create_index([("text", "text")])

# ------------------- Embeddings -------------------
embeddings_model = HuggingFaceEmbeddings(
    model_name=EMBEDDING_MODEL_NAME,
    model_kwargs={"device": "cpu"},
    encode_kwargs={"normalize_embeddings": True, "batch_size": 32}
)

@lru_cache(maxsize=1000)
def get_cached_embedding(text):
    return embeddings_model.embed_query(text)

# ------------------- Faster Whisper -------------------
whisper_model = WhisperModel("base", device="cuda")  # Use "cpu" if no GPU

# ------------------- FastAPI setup -------------------
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------- In-memory status -------------------
video_status: Dict[str, dict] = {}

# ------------------- Request Models -------------------
class VideoIngestRequest(BaseModel):
    video_url: str

class SearchRequest(BaseModel):
    video_id: str
    query: str
    top_k: int = 3

# ------------------- Helper functions -------------------
def download_audio(video_url: str, output_path: str):
    temp_file = output_path.replace(".mp3", "")
    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": temp_file,
        "postprocessors": [{"key": "FFmpegExtractAudio", "preferredcodec": "mp3"}],
        "quiet": False,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([video_url])
    final_file = temp_file + ".mp3"
    os.rename(final_file, output_path)

def split_audio_chunks(audio_path: str, chunk_length: int = 30):
    """Faster-whisper can handle chunking internally, so return full path."""
    return [{"path": audio_path, "start": 0, "end": None}]  # placeholder

async def process_chunk(video_id: str, segment: dict):
    """Transcribe + embed + save MongoDB for a single chunk."""
    try:
        audio_path = segment["path"]
        start = segment["start"]
        end = segment["end"]

        # Transcribe chunk
        for seg in whisper_model.transcribe(audio_path, chunk_length_s=30)[1]:
            text = seg.text.strip()
            embedding = embeddings_model.embed_documents([text])[0]

            doc = {
                "video_id": video_id,
                "start": seg.start,
                "end": seg.end,
                "text": text,
                "embedding": embedding
            }
            segments_collection.insert_one(doc)
            video_status[video_id]["segments"].append(doc)

    except Exception as e:
        print(f"Error in chunk processing: {e}")

def process_video_task(video_id: str, video_source: str):
    try:
        audio_file = f"{video_id}.mp3"
        if os.path.exists(video_source):
            audio_file = video_source
        else:
            download_audio(video_source, audio_file)

        video_status[video_id]["status"] = "processing"
        video_status[video_id]["segments"] = []

        # Split audio into chunks (for parallel processing)
        chunks = split_audio_chunks(audio_file, chunk_length=30)

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        tasks = [process_chunk(video_id, chunk) for chunk in chunks]
        loop.run_until_complete(asyncio.gather(*tasks))

        video_status[video_id]["status"] = "completed"
        print(f"Video {video_id} processed successfully!")

    except Exception as e:
        video_status[video_id]["status"] = "failed"
        video_status[video_id]["error"] = str(e)
        print(f"ERROR processing video {video_id}: {e}")

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

@app.post("/search")
async def search_video(req: SearchRequest):
    if req.video_id not in video_status or video_status[req.video_id]["status"] != "completed":
        return {"error": "Video not ready"}
    query_vector = get_cached_embedding(req.query)
    results = segments_collection.aggregate([
        {
            "$vectorSearch": {
                "queryVector": query_vector,
                "path": "embedding",
                "numCandidates": 100,
                "limit": req.top_k,
                "index": os.getenv("MONGO_VECTOR_INDEX", "vector_index")
            }
        },
        {"$project": {"_id": 1, "text": 1, "start": 1, "end": 1, "score": {"$meta": "vectorSearchScore"}}}
    ])
    return {"results": list(results)}

@app.get("/download_transcript")
async def download_transcript(video_id: str):
    if video_id not in video_status or video_status[video_id]["status"] != "completed":
        return {"error": "Video not ready"}
    segments = video_status[video_id]["segments"]
    path = f"{video_id}_transcript.txt"
    with open(path, "w", encoding="utf-8") as f:
        for seg in segments:
            f.write(f"{seg['start']} - {seg['end']}\n{seg['text']}\n\n")
    return FileResponse(path, filename="transcript.txt", media_type="text/plain")

@app.get("/")
async def root():
    return {"message": "Lecture Navigator Backend running."}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001, reload=True)
