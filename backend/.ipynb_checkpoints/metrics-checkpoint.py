import os
import csv
import time
import numpy as np
from pymongo import MongoClient
from dotenv import load_dotenv
from langchain_huggingface import HuggingFaceEmbeddings

# ------------------- Load environment -------------------
load_dotenv()
MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB = os.getenv("MONGO_DB", "test")
MONGO_COLLECTION = os.getenv("MONGO_COLLECTION", "vectors")
EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL_NAME", "all-MiniLM-L6-v2")

# ------------------- MongoDB setup -------------------
mongo_client = MongoClient(MONGO_URI)
db = mongo_client[MONGO_DB]
segments_collection = db[MONGO_COLLECTION]

# ------------------- Embeddings -------------------
embeddings_model = HuggingFaceEmbeddings(
    model_name=EMBEDDING_MODEL_NAME,
    model_kwargs={"device": "cpu"},
    encode_kwargs={"normalize_embeddings": True, "batch_size": 32}
)

def embed_query(text):
    return np.array(embeddings_model.embed_query(text))

# ------------------- Helper functions -------------------
def compute_mrr(relevant_ranks):
    """Compute Mean Reciprocal Rank for a list of relevant segment ranks"""
    for rank in relevant_ranks:
        if rank >= 1:  # first relevant document found
            return 1.0 / rank
    return 0.0

def merge_segments_by_window(segments, window_size):
    """
    Merge transcription segments into windows of size `window_size` seconds.
    Returns a list of dicts with 'start', 'end', 'text', 'embedding'.
    """
    merged = []
    current_window = {"start": 0, "end": window_size, "text": ""}
    texts = []
    for seg in segments:
        if seg["start"] < current_window["end"]:
            texts.append(seg["text"])
        else:
            if texts:
                merged.append({
                    "start": current_window["start"],
                    "end": current_window["end"],
                    "text": " ".join(texts),
                    "embedding": embeddings_model.embed_documents([" ".join(texts)])[0]
                })
            # start new window
            current_window = {"start": current_window["end"], "end": current_window["end"] + window_size}
            texts = [seg["text"]]
    if texts:
        merged.append({
            "start": current_window["start"],
            "end": current_window["end"],
            "text": " ".join(texts),
            "embedding": embeddings_model.embed_documents([" ".join(texts)])[0]
        })
    return merged

def evaluate_search(video_id, queries, window_size=30, top_k=10):
    """Evaluate search for a given video with specified window size"""
    all_segments = list(segments_collection.find({"video_id": video_id}))
    if not all_segments:
        return None

    # Merge segments by window
    merged_segments = merge_segments_by_window(all_segments, window_size)

    mrr_scores = []
    latencies = []

    for q in queries:
        start_time = time.time()
        q_vector = embed_query(q["query"])
        q_norm = np.linalg.norm(q_vector)

        scored_segments = []
        for seg in merged_segments:
            seg_vector = np.array(seg["embedding"])
            seg_norm = np.linalg.norm(seg_vector)
            score = float(np.dot(seg_vector, q_vector) / (seg_norm * q_norm + 1e-10))
            scored_segments.append((score, seg["start"]))

        scored_segments = sorted(scored_segments, key=lambda x: x[0], reverse=True)[:top_k]

        # Compute ranks of relevant segments
        relevant_starts = q.get("relevant_starts", [])
        ranks = [i+1 for i, (_, start) in enumerate(scored_segments) if start in relevant_starts]
        mrr = compute_mrr(ranks)
        mrr_scores.append(mrr)

        latencies.append(time.time() - start_time)

    return {
        "video_id": video_id,
        "window_size": window_size,
        "MRR@10": np.mean(mrr_scores),
        "avg_latency": np.mean(latencies),
        "p95_latency": np.percentile(latencies, 95)
    }

# ------------------- Main -------------------
if __name__ == "__main__":
    # Example queries; replace 'relevant_starts' with actual segment start times
    queries = [
        {"query": "introduction to AI", "relevant_starts": []},
        {"query": "whisper transcription", "relevant_starts": []},
        {"query": "video embeddings", "relevant_starts": []}
    ]

    results = []
    video_ids = segments_collection.distinct("video_id")

    for vid in video_ids:
        print(f"Evaluating video_id: {vid}")
        for window_size in [30, 60]:
            metrics = evaluate_search(vid, queries, window_size=window_size)
            if metrics:
                print(metrics)
                results.append(metrics)

    # Save to CSV
    csv_file = "metrics_with_ablation.csv"
    with open(csv_file, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["video_id", "window_size", "MRR@10", "avg_latency", "p95_latency"])
        writer.writeheader()
        writer.writerows(results)

    print(f"Metrics saved to {csv_file}")
