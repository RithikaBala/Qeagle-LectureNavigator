


import React, { useState , useEffect} from "react";
import { FiFile } from "react-icons/fi";
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

// ---------------- LandingPage ----------------
function LandingPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-100 to-purple-200">
      <motion.h1
        className="text-6xl font-bold text-black mb-8 text-center"
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: "easeOut" }}
      >
        Lecture Navigator
      </motion.h1>
      <motion.button
        onClick={() => navigate("/main")}
        className="bg-blue-600 text-white py-3 px-8 rounded-lg text-xl font-semibold shadow-lg mt-4"
        whileHover={{ scale: 1.05, boxShadow: "0px 10px 20px rgba(0,0,0,0.2)" }}
        whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      >
        Get Started
      </motion.button>
    </div>
  );
}

// ---------------- Spinner ----------------
function Spinner() {
  return (
    <div className="inline-block w-5 h-5 border-2 border-t-transparent border-blue-600 rounded-full animate-spin mr-2"></div>
  );
}

// ---------------- Helpers ----------------
function toEmbedUrl(url, start = 0) {
  const videoId = url.includes("youtube") ? url.split("v=")[1]?.split("&")[0] : null;
  return videoId ? `https://www.youtube.com/embed/${videoId}?start=${Math.floor(start)}` : url;
}

function formatTime(seconds) {
  if (seconds === undefined || isNaN(seconds)) return "00:00:00";
  const h = Math.floor(seconds / 3600).toString().padStart(2, "0");
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

// ---------------- Library Component ----------------
function Library({ libraryVideos, setSelectedVideo }) {
  return (
    <div className="flex flex-col gap-3">
      {libraryVideos.map((video, index) => (
        <div
          key={index}
          onClick={() => setSelectedVideo(video.url)}
          className="flex items-center gap-3 p-4 rounded-lg hover:bg-gray-200 cursor-pointer transition text-black shadow-2xl"
        >
          <span className="text-2xl">▶️</span>
          <span>{video.title}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------- AppContent ----------------
function AppContent({
  query, setQuery,
  videoUrl, setVideoUrl,
  videoFile, setVideoFile,
  videoId, setVideoId,
  selectedVideo, setSelectedVideo,
  loading, setLoading,
  status, setStatus,
  libraryVideos, setLibraryVideos,
}) {
  const navigate = useNavigate();

  const pollVideoStatus = (videoId) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`http://127.0.0.1:8001/status?video_id=${videoId}`);
        const data = await res.json();
        setStatus(data.status);
        if (data.status === "completed" || data.status === "failed") clearInterval(interval);
      } catch (error) {
        console.error(error);
        clearInterval(interval);
      }
    }, 3000);
  };

  const handleVideoUpload = async () => {
    if (!videoUrl && !videoFile) return alert("Please provide a URL or select a file.");
    setLoading(true);
    try {
      let res;
      if (videoFile) {
        const formData = new FormData();
        formData.append("file", videoFile);
        res = await fetch("http://127.0.0.1:8001/ingest_file", { method: "POST", body: formData });
      } else {
        res = await fetch("http://127.0.0.1:8001/ingest_video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ video_url: videoUrl }),
        });
      }
      const data = await res.json();
      setVideoId(data.video_id);
      const videoSrc = videoFile ? URL.createObjectURL(videoFile) : videoUrl;
      setSelectedVideo(videoSrc);

      setStatus("processing");
      pollVideoStatus(data.video_id);

      const newVideo = { title: "Uploaded Video", url: videoSrc, queries: [] };
      setLibraryVideos(prev => [newVideo, ...prev]);

    } catch (error) {
      console.error(error);
      alert("Failed to upload video.");
    }
    setLoading(false);
  };

  const handleSearch = async () => {
    if (!query.trim() || !videoId) return;
    setLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:8001/rag_hf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_id: videoId, query, top_k: 5 }),
      });
      const data = await res.json();

      // Map results
      const parsedResults = data.segments.map(item => ({
        time: Math.floor(item.start),
        snippet: item.text
      }));

      navigate("/results", { state: { selectedVideo, results: parsedResults, ragAnswer: data.answer } });

      setLibraryVideos(prev =>
        prev.map(v => (v.url === selectedVideo ? { ...v, queries: [...(v.queries || []), query] } : v))
      );

    } catch (error) {
      console.error(error);
      alert("Search failed");
    }
    setLoading(false);
  };

  const downloadTranscript = () => {
    if (!videoId) return;
    fetch(`http://127.0.0.1:8001/download_transcript?video_id=${videoId}`)
      .then(res => res.text())
      .then(text => {
        const blob = new Blob([text], { type: "text/plain" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "transcript.txt";
        link.click();
      });
  };

  return (
    <div className="min-h-screen bg-gray-200 px-6 py-8 flex flex-col items-center">
      <h1 className="text-4xl text-black font-bold mb-8 text-center">Lecture Navigator</h1>
      <div className="flex w-full max-w-7xl gap-6 transition-all duration-700">

        <motion.div animate={{ width: selectedVideo ? "25%" : "50%" }} transition={{ duration: 0.5 }} className="flex flex-col gap-6">
          {/* Upload Section */}
          <div className="bg-white p-8 rounded-2xl shadow-2xl">
            <h2 className="text-2xl font-semibold mb-4 text-black">Upload Video</h2>
            <div className="flex gap-4 mb-4">
              <input type="text" placeholder="https://www.youtube.com/..." value={videoUrl} onChange={e => setVideoUrl(e.target.value)} className="w-3/4 px-4 py-2 rounded-lg border border-gray-300 text-black"/>
              <label className="w-1/4 flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer bg-white">
                <FiFile className="text-gray-600 text-xl" />
                <span>{videoFile ? videoFile.name : "Choose File"}</span>
                <input type="file" accept="video/*,audio/*" onChange={e => setVideoFile(e.target.files[0])} className="hidden" />
              </label>
            </div>
            <button onClick={handleVideoUpload} disabled={loading} className="w-full bg-gradient-to-r from-orange-400 to-pink-500 py-2 rounded-lg font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {loading ? "Processing..." : "Upload"}
            </button>
            {status && (
              <p className="mt-2 text-black flex items-center">
                {status === "processing" && <Spinner />}
                {status === "processing" ? "Processing..." : status === "failed" ? "Failed ❌" : "Completed ✅"}
              </p>
            )}
          </div>

          {/* Search Section */}
          <div className="bg-white p-8 rounded-2xl shadow-2xl">
            <h2 className="text-2xl font-semibold mb-2 text-black">Ask a Question</h2>
            <input type="text" placeholder="Ask a question..." value={query} onChange={e => setQuery(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-gray-300 text-black mb-2"/>
            <button onClick={handleSearch} disabled={loading || status !== "completed"} className="w-full bg-blue-600 py-2 rounded-lg font-semibold text-white hover:opacity-90 disabled:opacity-50 flex items-center justify-center">
              {loading ? "Searching..." : status !== "completed" ? <><Spinner /> Search</> : "Search"}
            </button>
            <button onClick={downloadTranscript} disabled={!videoId} className="w-50 mt-4 bg-green-600 py-2 rounded-lg text-white font-semibold hover:bg-green-700 flex flex-col items-center justify-center mx-auto">
              Download Transcript
            </button>
          </div>
        </motion.div>

        {/* Selected Video Preview */}
        <AnimatePresence>
          {selectedVideo && (
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.5 }} className="relative w-1/2 flex items-center justify-center">
              <button onClick={() => setSelectedVideo(null)} className="absolute top-2 right-2 z-10 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-600">×</button>
              <div className="bg-gray-800 p-2 rounded-lg shadow-lg w-full h-full flex items-center justify-center">
                {selectedVideo.includes("youtube") ? <iframe src={toEmbedUrl(selectedVideo)} title="Selected Video" frameBorder="0" allowFullScreen className="w-full h-full rounded-lg"/> : <video controls key={selectedVideo} className="w-full h-full rounded-lg" src={selectedVideo}/>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Library */}
        <motion.div animate={{ width: selectedVideo ? "25%" : "50%" }} transition={{ duration: 0.5 }} className="bg-white p-8 rounded-2xl shadow-2xl">
          <h2 className="text-2xl font-semibold mb-4 text-black">Library</h2>
          <Library libraryVideos={libraryVideos.slice(0, 5)} setSelectedVideo={setSelectedVideo} />
          {libraryVideos.length > 5 && <button onClick={() => navigate("/library")} className="mt-2 text-blue-600 underline hover:text-blue-800">See More</button>}
        </motion.div>

      </div>
    </div>
  );
}

// ---------- RESULTS PAGE FIXED ----------
function ResultsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { selectedVideo, results, ragAnswer } = location.state || {};
  const [activeVideoTime, setActiveVideoTime] = useState(null);

  // ✅ Fix: Safe redirect using useEffect
  useEffect(() => {
    if (!selectedVideo || !Array.isArray(results)) {
      navigate("/main", { replace: true });
    }
  }, [selectedVideo, results, navigate]);

  if (!selectedVideo || !Array.isArray(results)) {
    return null; // Avoid rendering during redirect
  }

  return (
    <div className="min-h-screen bg-gray-200 px-6 py-8 flex flex-col items-center">
      <h1 className="text-4xl text-black font-bold mb-8 text-center">
        Search Results
      </h1>

      <div className="flex flex-col w-full max-w-4xl gap-4">
        {results.map((res, idx) => (
          <div key={idx} className="bg-white p-4 rounded-xl shadow-lg flex flex-col gap-2">
            <p className="text-sm text-gray-500">
              Timestamp: {formatTime(res.time)}
            </p>
            <p className="text-black font-medium">Snippet: {res.snippet}</p>
            <button
              onClick={() => setActiveVideoTime(idx)}
              className="mt-2 bg-blue-600 text-white py-1 px-3 rounded hover:bg-blue-700 w-fit"
            >
              Play Segment
            </button>

            {activeVideoTime === idx && (
              selectedVideo.includes("youtube") ? (
                <iframe
                  key={idx}
                  src={toEmbedUrl(selectedVideo, res.time)}
                  title={`video-${idx}`}
                  frameBorder="0"
                  allowFullScreen
                  className="w-full h-60 mt-2 rounded-lg shadow-lg"
                />
              ) : (
                <video
                  controls
                  autoPlay
                  src={selectedVideo}
                  className="w-full h-60 mt-2 rounded-lg shadow-lg"
                />
              )
            )}
          </div>
        ))}

        {/* ✅ Fix: use <div> instead of <p> to avoid hydration error */}
        <div className="bg-yellow-100 p-4 rounded-xl shadow-lg mt-4">
          <h2 className="text-xl font-semibold mb-2">AI Answer:</h2>
          <div className="text-black">{ragAnswer}</div>
        </div>

        <button
          onClick={() => navigate("/main")}
          className="mt-4 bg-gray-600 text-white py-2 px-6 rounded hover:bg-gray-700"
        >
          Back to Upload
        </button>
      </div>
    </div>
  );
}


// ---------------- LibraryPage ----------------
function LibraryPage({ libraryVideos, setLibraryVideos }) {
  const navigate = useNavigate();
  const [editableTitles, setEditableTitles] = useState(libraryVideos.map(v => v.title));

  const handleTitleChange = (idx, newTitle) => {
    setEditableTitles(prev => {
      const copy = [...prev];
      copy[idx] = newTitle;
      return copy;
    });
    setLibraryVideos(prev => prev.map((v, i) => i === idx ? { ...v, title: newTitle } : v));
  };

  return (
    <div className="min-h-screen bg-gray-200 px-6 py-8">
      <h1 className="text-4xl text-black font-bold mb-8 text-center">Library</h1>
      <div className="max-w-4xl mx-auto flex flex-col gap-3">
        {libraryVideos.map((video, idx) => (
          <div key={idx} className="bg-white p-4 rounded-2xl shadow-lg flex flex-col gap-2">
            <div className="flex items-center gap-3 cursor-pointer">
              <span className="text-2xl">▶️</span>
              <input
                type="text"
                value={editableTitles[idx]}
                onChange={(e) => handleTitleChange(idx, e.target.value)}
                className="text-black font-medium border-b border-gray-300 focus:outline-none"
              />
            </div>
            {video.queries && video.queries.length > 0 && (
              <p className="text-gray-600 text-sm">Queries: {video.queries.join(", ")}</p>
            )}
          </div>
        ))}
        <button
          onClick={() => navigate("/main")}
          className="mt-4 bg-gray-600 text-white py-2 px-6 rounded hover:bg-gray-700"
        >
          Back to Upload
        </button>
      </div>
    </div>
  );
}

// ---------------- Main App ----------------
export default function App() {
  const [videoUrl, setVideoUrl] = useState("");
  const [videoFile, setVideoFile] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [videoId, setVideoId] = useState(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [libraryVideos, setLibraryVideos] = useState([
     { title: "Java Full course", url: "https://www.youtube.com/embed/eIrMbAQSU34", queries: [] },
     { title: "Machine Learning Full course", url: "https://www.youtube.com/embed/i_LwzRVP7bg", queries: [] },
     { title: "AI Full course", url: "https://www.youtube.com/embed/5NgNicANyqM", queries: [] },
     { title: "Python for Beginners", url: "https://www.youtube.com/embed/K5KVEU3aaeQ", queries: [] },
     { title: "React Full Course", url: "https://www.youtube.com/embed/DG7lQQ2ZxjE", queries: [] }
   ]);

  return (
    <Router>
      <Routes>
  <Route path="/" element={<LandingPage />} />
  <Route path="/main" element={
    <AppContent
      videoUrl={videoUrl} setVideoUrl={setVideoUrl}
      videoFile={videoFile} setVideoFile={setVideoFile}
      selectedVideo={selectedVideo} setSelectedVideo={setSelectedVideo}
      videoId={videoId} setVideoId={setVideoId}
      query={query} setQuery={setQuery}
      loading={loading} setLoading={setLoading}
      status={status} setStatus={setStatus}
      libraryVideos={libraryVideos} setLibraryVideos={setLibraryVideos}
    />
  } />
  <Route path="/results" element={<ResultsPage />} />
  
  {/* Add this */}
  <Route path="/library" element={
    <LibraryPage libraryVideos={libraryVideos} setLibraryVideos={setLibraryVideos} />
  } />
</Routes>

    </Router>
  );
}
