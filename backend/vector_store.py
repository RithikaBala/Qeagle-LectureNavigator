# vector_store.py
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

class VectorStore:
    def __init__(self):
        self.vectors = []
        self.metadata = []

    def add_vector(self, vector, text, video_url, start_time=None, end_time=None):
        self.vectors.append(vector)
        self.metadata.append({
            "text": text,
            "video_url": video_url,
            "start_time": start_time,
            "end_time": end_time
        })

    def similarity_search(self, query_vector, top_k=3):
        if not self.vectors:
            return []

        vecs = np.array(self.vectors)
        query_vec = np.array(query_vector).reshape(1, -1)
        scores = cosine_similarity(query_vec, vecs)[0]

        top_idx = scores.argsort()[-top_k:][::-1]
        results = []
        for idx in top_idx:
            results.append(self.metadata[idx])
        return results
