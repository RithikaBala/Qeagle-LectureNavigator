

// import React, { useState, useRef } from "react";
// import { FiFile } from "react-icons/fi";
// import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from "react-router-dom";

// // ---------------- Spinner ----------------
// function Spinner() {
//   return (
//     <div className="inline-block w-5 h-5 border-2 border-t-transparent border-blue-600 rounded-full animate-spin mr-2"></div>
//   );
// }

// // ---------------- Helpers ----------------
// function toEmbedUrl(url, start = 0) {
//   const videoId = url.includes("youtube") ? url.split("v=")[1]?.split("&")[0] : null;
//   return videoId
//     ? `https://www.youtube.com/embed/${videoId}?start=${Math.floor(start)}`
//     : url;
// }

// function formatTime(seconds) {
//   const h = Math.floor(seconds / 3600).toString().padStart(2, "0");
//   const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0");
//   const s = Math.floor(seconds % 60).toString().padStart(2, "0");
//   return `${h}:${m}:${s}`;
// }

// // ---------------- Library Component ----------------
// function Library({ libraryVideos, setSelectedVideo }) {
//   return (
//     <div className="flex flex-col gap-3">
//       {libraryVideos.map((video, index) => (
//         <div
//           key={index}
//           onClick={() => setSelectedVideo(video.url)}
//           className="flex items-center gap-3 p-4 rounded-lg hover:bg-gray-200 cursor-pointer transition text-black shadow-2xl"
//         >
//           <span className="text-2xl">▶️</span>
//           <span>{video.title}</span>
//         </div>
//       ))}
//     </div>
//   );
// }

// // ---------------- AppContent ----------------
// function AppContent({
//   query, setQuery,
//   videoUrl, setVideoUrl,
//   videoFile, setVideoFile,
//   videoId, setVideoId,
//   selectedVideo, setSelectedVideo,
//   loading, setLoading,
//   status, setStatus,
//   libraryVideos, setLibraryVideos,
// }) {
//   const navigate = useNavigate();

//   const pollVideoStatus = (videoId) => {
//     const interval = setInterval(async () => {
//       try {
//         const res = await fetch(`http://127.0.0.1:8001/status?video_id=${videoId}`);
//         const data = await res.json();
//         setStatus(data.status);
//         if (data.status === "completed" || data.status === "failed") clearInterval(interval);
//       } catch (error) {
//         console.error(error);
//         clearInterval(interval);
//       }
//     }, 3000);
//   };

//   const handleVideoUpload = async () => {
//     if (!videoUrl && !videoFile) return alert("Please provide a URL or select a file.");
//     setLoading(true);
//     try {
//       let res;
//       if (videoFile) {
//         const formData = new FormData();
//         formData.append("file", videoFile);
//         res = await fetch("http://127.0.0.1:8001/ingest_file", { method: "POST", body: formData });
//       } else {
//         res = await fetch("http://127.0.0.1:8001/ingest_video", {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({ video_url: videoUrl }),
//         });
//       }
//       const data = await res.json();
//       setVideoId(data.video_id);

//       const videoSrc = videoFile ? URL.createObjectURL(videoFile) : videoUrl;
//       setSelectedVideo(videoSrc);

//       setStatus("processing");
//       pollVideoStatus(data.video_id);

//       const newVideo = { title: "Uploaded Video", url: videoSrc, queries: [] };
//       setLibraryVideos(prev => [newVideo, ...prev]);

//     } catch (error) {
//       console.error(error);
//       alert("Failed to upload video.");
//     }
//     setLoading(false);
//   };

//   const handleSearch = async () => {
//     if (!query.trim() || !videoId) return;
//     if (status !== "completed") return alert("Video still processing");
//     setLoading(true);
//     try {
//       const res = await fetch("http://127.0.0.1:8001/search", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ video_id: videoId, query, top_k: 5 }),
//       });
//       const data = await res.json();

//       const parsedResults = data.results.map(item => ({
//         time: Math.floor(item.start),
//         snippet: item.text
//       }));

//       navigate("/results", { state: { selectedVideo, results: parsedResults } });

//       setLibraryVideos(prev =>
//         prev.map(v => (v.url === selectedVideo ? { ...v, queries: [...(v.queries || []), query] } : v))
//       );

//     } catch (error) {
//       console.error(error);
//       alert("Search failed");
//     }
//     setLoading(false);
//   };

//   const downloadTranscript = () => {
//     if (!videoId) return;
//     fetch(`http://127.0.0.1:8001/download_transcript?video_id=${videoId}`)
//       .then(res => res.text())
//       .then(text => {
//         const blob = new Blob([text], { type: "text/plain" });
//         const link = document.createElement("a");
//         link.href = URL.createObjectURL(blob);
//         link.download = "transcript.txt";
//         link.click();
//       });
//   };

//   return (
//     <div className="min-h-screen bg-gray-200 px-6 py-8 flex flex-col items-center">
//       <h1 className="text-4xl text-black font-bold mb-8 text-center">Lecture Navigator</h1>

//       <div className="flex w-full max-w-7xl gap-6 transition-all duration-700">

//         {/* Left Upload & Query */}
//         <div className={`${selectedVideo ? "w-1/4" : "w-1/2"} flex flex-col gap-6`}>
//           <div className="bg-white p-8 rounded-2xl shadow-2xl">
//             <h2 className="text-2xl font-semibold mb-4 text-black">Upload Video</h2>
//             <div className="flex gap-4 mb-4">
//               <input
//                 type="text"
//                 placeholder="https://www.youtube.com/..."
//                 value={videoUrl}
//                 onChange={e => setVideoUrl(e.target.value)}
//                 className="w-1/2 px-4 py-2 rounded-lg border border-gray-300 text-black"
//               />
//               <label className="w-1/2 flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer bg-white">
//                 <FiFile className="text-gray-600 text-xl" />
//                 <span>{videoFile ? videoFile.name : "Choose File"}</span>
//                 <input
//                   type="file"
//                   accept="video/*,audio/*"
//                   onChange={e => setVideoFile(e.target.files[0])}
//                   className="hidden"
//                 />
//               </label>
//             </div>
//             <button
//               onClick={handleVideoUpload}
//               disabled={loading}
//               className="w-full bg-gradient-to-r from-orange-400 to-pink-500 py-2 rounded-lg font-semibold text-white hover:opacity-90 disabled:opacity-50"
//             >
//               {loading ? "Processing..." : "Upload"}
//             </button>
//             {status && (
//               <p className="mt-2 text-black flex items-center">
//                 {status === "processing" && <Spinner />}
//                 {status === "processing" ? "Processing..." : status === "failed" ? "Failed ❌" : "Completed ✅"}
//               </p>
//             )}
//           </div>

//           <div className="bg-white p-8 rounded-2xl shadow-2xl">
//             <h2 className="text-2xl font-semibold mb-2 text-black">Ask a Question</h2>
//             <input
//               type="text"
//               placeholder="Ask a question..."
//               value={query}
//               onChange={e => setQuery(e.target.value)}
//               className="w-full px-4 py-2 rounded-lg border border-gray-300 text-black mb-2"
//             />
//             <button
//               onClick={handleSearch}
//               disabled={loading || status !== "completed"}
//               className="w-full bg-blue-600 py-2 rounded-lg font-semibold text-white hover:opacity-90 disabled:opacity-50 flex items-center justify-center"
//             >
//               {loading ? "Searching..." : status !== "completed" ? <><Spinner /> Waiting...</> : "Search"}
//             </button>
//             <button
//               onClick={downloadTranscript}
//               disabled={!videoId}
//               className="w-full mt-2 bg-green-600 py-2 rounded-lg text-white font-semibold hover:bg-green-700"
//             >
//               Download Transcript
//             </button>
//           </div>
//         </div>

//         {/* Middle Video */}
//         {selectedVideo && (
//           <div className="w-1/2 flex items-center justify-center">
//             <div className="bg-gray-800 p-2 rounded-lg shadow-lg w-full h-full flex items-center justify-center">
//               {selectedVideo.includes("youtube") ? (
//                 <iframe
//                   src={toEmbedUrl(selectedVideo)}
//                   title="Selected Video"
//                   frameBorder="0"
//                   allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
//                   allowFullScreen
//                   className="w-full h-full rounded-lg"
//                 />
//               ) : (
//                 <video
//                   controls
//                   key={selectedVideo}
//                   className="w-full h-full rounded-lg"
//                   src={selectedVideo}
//                 />
//               )}
//             </div>
//           </div>
//         )}

//         {/* Right Library */}
//         <div className={`${selectedVideo ? "w-1/4" : "w-1/2"} bg-white p-8 rounded-2xl shadow-2xl`}>
//           <h2 className="text-2xl font-semibold mb-4 text-black">Library</h2>
//           <Library libraryVideos={libraryVideos.slice(0, 5)} setSelectedVideo={setSelectedVideo} />
//           {libraryVideos.length > 5 && (
//             <button
//               onClick={() => navigate("/library")}
//               className="mt-2 text-blue-600 underline hover:text-blue-800"
//             >
//               See More
//             </button>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }

// // ---------------- ResultsPage ----------------
// function ResultsPage() {
//   const location = useLocation();
//   const navigate = useNavigate();
//   const { selectedVideo, results } = location.state || {};
//   const [activeVideoTime, setActiveVideoTime] = useState(null);

//   if (!selectedVideo || !results) return navigate("/");

//   const handleGoTo = (time, idx) => {
//     setActiveVideoTime(idx);
//   };

//   return (
//     <div className="min-h-screen bg-gray-200 px-6 py-8 flex flex-col items-center">
//       <h1 className="text-4xl text-black font-bold mb-8 text-center">Search Results</h1>
//       <div className="flex flex-col w-full max-w-4xl gap-4">
//         {results.slice(0, 3).map((res, idx) => (
//           <div key={idx} className="bg-white p-4 rounded-xl shadow-lg flex flex-col gap-2">
//             <p className="text-sm text-gray-500">Timestamp: {formatTime(res.time)}</p>
//             <p className="text-black font-medium">Snippet: {res.snippet}</p>
//             <button
//               onClick={() => handleGoTo(res.time, idx)}
//               className="mt-2 bg-blue-600 text-white py-1 px-3 rounded hover:bg-blue-700 w-fit"
//             >
//               play this segment
//             </button>

//             {activeVideoTime === idx && (
//               selectedVideo.includes("youtube") ? (
//                 <iframe
//                   key={idx}
//                   src={toEmbedUrl(selectedVideo, res.time)}
//                   title={`video-${idx}`}
//                   frameBorder="0"
//                   allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
//                   allowFullScreen
//                   className="w-full h-60 mt-2 rounded-lg shadow-lg"
//                 />
//               ) : (
//                 <video
//                   controls
//                   autoPlay
//                   src={selectedVideo}
//                   className="w-full h-60 mt-2 rounded-lg shadow-lg"
//                 />
//               )
//             )}
//           </div>
//         ))}
//         <button
//           onClick={() => navigate("/")}
//           className="mt-4 bg-gray-600 text-white py-2 px-6 rounded hover:bg-gray-700 w-fit"
//         >
//           Back to Upload
//         </button>
//       </div>
//     </div>
//   );
// }

// // ---------------- LibraryPage ----------------
// function LibraryPage({ libraryVideos, setLibraryVideos }) {
//   const navigate = useNavigate();
//   const [editableTitles, setEditableTitles] = useState(libraryVideos.map(v => v.title));

//   const handleTitleChange = (idx, newTitle) => {
//     setEditableTitles(prev => {
//       const copy = [...prev];
//       copy[idx] = newTitle;
//       return copy;
//     });
//     setLibraryVideos(prev => prev.map((v, i) => i === idx ? { ...v, title: newTitle } : v));
//   };

//   return (
//     <div className="min-h-screen bg-gray-200 px-6 py-8">
//       <h1 className="text-4xl text-black font-bold mb-8 text-center">Library</h1>
//       <div className="max-w-4xl mx-auto flex flex-col gap-3">
//         {libraryVideos.map((video, idx) => (
//           <div key={idx} className="bg-white p-4 rounded-2xl shadow-lg flex flex-col gap-2">
//             <div className="flex items-center gap-3 cursor-pointer">
//               <span className="text-2xl">▶️</span>
//               <input
//                 type="text"
//                 value={editableTitles[idx]}
//                 onChange={(e) => handleTitleChange(idx, e.target.value)}
//                 className="text-black font-medium border-b border-gray-300 focus:outline-none"
//               />
//             </div>
//             {video.queries && video.queries.length > 0 && (
//               <p className="text-gray-600 text-sm">Queries: {video.queries.join(", ")}</p>
//             )}
//           </div>
//         ))}
//         <button
//           onClick={() => navigate("/")}
//           className="mt-4 bg-gray-600 text-white py-2 px-6 rounded hover:bg-gray-700"
//         >
//           Back to Upload
//         </button>
//       </div>
//     </div>
//   );
// }

// // ---------------- Root App ----------------
// export default function App() {
//   const [query, setQuery] = useState("");
//   const [videoUrl, setVideoUrl] = useState("");
//   const [videoFile, setVideoFile] = useState(null);
//   const [videoId, setVideoId] = useState(null);
//   const [selectedVideo, setSelectedVideo] = useState(null);
//   const [loading, setLoading] = useState(false);
//   const [status, setStatus] = useState(null);
//   const [libraryVideos, setLibraryVideos] = useState([
//     { title: "Java Full course", url: "https://www.youtube.com/embed/eIrMbAQSU34", queries: [] },
//     { title: "Machine Learning Full course", url: "https://www.youtube.com/embed/i_LwzRVP7bg", queries: [] },
//     { title: "AI Full course", url: "https://www.youtube.com/embed/5NgNicANyqM", queries: [] },
//     { title: "Python for Beginners", url: "https://www.youtube.com/embed/K5KVEU3aaeQ", queries: [] },
//     { title: "React Full Course", url: "https://www.youtube.com/embed/DG7lQQ2ZxjE", queries: [] }
//   ]);

//   return (
//     <Router>
//       <Routes>
//         <Route path="/" element={
//           <AppContent
//             query={query} setQuery={setQuery}
//             videoUrl={videoUrl} setVideoUrl={setVideoUrl}
//             videoFile={videoFile} setVideoFile={setVideoFile}
//             videoId={videoId} setVideoId={setVideoId}
//             selectedVideo={selectedVideo} setSelectedVideo={setSelectedVideo}
//             loading={loading} setLoading={setLoading}
//             status={status} setStatus={setStatus}
//             libraryVideos={libraryVideos} setLibraryVideos={setLibraryVideos}
//           />
//         } />
//         <Route path="/results" element={<ResultsPage />} />
//         <Route path="/library" element={
//           <LibraryPage
//             libraryVideos={libraryVideos} setLibraryVideos={setLibraryVideos}
//           />
//         } />
//       </Routes>
//     </Router>
//   );
// }


import React, { useState, useRef } from "react";
import { FiFile, FiEdit } from "react-icons/fi";
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from "react-router-dom";

// ---------------- Spinner ----------------
function Spinner() {
  return (
    <div className="inline-block w-5 h-5 border-2 border-t-transparent border-blue-600 rounded-full animate-spin mr-2"></div>
  );
}

// ---------------- Helpers ----------------
function toEmbedUrl(url, start = 0) {
  const videoId = url.includes("youtube") ? url.split("v=")[1]?.split("&")[0] : null;
  return videoId
    ? `https://www.youtube.com/embed/${videoId}?start=${Math.floor(start)}`
    : url;
}

function formatTime(seconds) {
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
          <span className="">{video.title}</span>
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
    }, 1000); // faster polling
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

  // ---------------- Streaming Search ----------------
  const handleSearch = async () => {
    if (!query.trim() || !videoId) return;
    if (status !== "completed") return alert("Video still processing");
    setLoading(true);

    try {
      const res = await fetch(
        `http://127.0.0.1:8001/search_stream?video_id=${videoId}&query=${encodeURIComponent(query)}&top_k=5`
      );

      if (!res.ok || !res.body) throw new Error("Failed to stream search");

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      const parsedResults = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split("\n\n");
        buffer = parts.pop(); // keep incomplete chunk

        for (const part of parts) {
          if (part.startsWith("data:")) {
            try {
              const jsonStr = part.replace(/^data:\s*/, "");
              const item = JSON.parse(jsonStr);
              parsedResults.push({
                time: Math.floor(item.start),
                snippet: item.text
              });

              // Navigate immediately with streaming results
              navigate("/results", {
                state: { selectedVideo, results: [...parsedResults] }
              });
            } catch (e) {
              console.error("Failed to parse SSE chunk:", e);
            }
          }
        }
      }

      // Save query into library
      setLibraryVideos(prev =>
        prev.map(v =>
          v.url === selectedVideo
            ? { ...v, queries: [...(v.queries || []), query] }
            : v
        )
      );
    } catch (error) {
      console.error(error);
      alert("Streaming search failed");
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

        {/* Left Upload & Query */}
        <div className={`${selectedVideo ? "w-1/4" : "w-1/2"} flex flex-col gap-6`}>
          <div className="bg-white p-8 rounded-2xl shadow-2xl">
            <h2 className="text-2xl font-semibold mb-4 text-black">Upload Video</h2>
            <div className="flex gap-4 mb-4">
              <input
                type="text"
                placeholder="https://www.youtube.com/..."
                value={videoUrl}
                onChange={e => setVideoUrl(e.target.value)}
                className="w-1/2 px-4 py-2 rounded-lg border border-gray-300 text-black"
              />
              <label className="w-1/2 flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer bg-white">
                <FiFile className="text-gray-600 text-xl" />
                <span>{videoFile ? videoFile.name : "Choose File"}</span>
                <input
                  type="file"
                  accept="video/*,audio/*"
                  onChange={e => setVideoFile(e.target.files[0])}
                  className="hidden"
                />
              </label>
            </div>
            <button
              onClick={handleVideoUpload}
              disabled={loading}
              className="w-full bg-gradient-to-r from-orange-400 to-pink-500 py-2 rounded-lg font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Processing..." : "Upload"}
            </button>
            {status && (
              <p className="mt-2 text-black flex items-center">
                {status === "processing" && <Spinner />}
                {status === "processing" ? "Processing..." : status === "failed" ? "Failed ❌" : "Completed ✅"}
              </p>
            )}
          </div>

          <div className="bg-white p-8 rounded-2xl shadow-2xl">
            <h2 className="text-2xl font-semibold mb-2 text-black">Ask a Question</h2>
            <input
              type="text"
              placeholder="Ask a question..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 text-black mb-2"
            />
            <button
              onClick={handleSearch}
              disabled={loading || status !== "completed"}
              className="w-full bg-blue-600 py-2 rounded-lg font-semibold text-white hover:opacity-90 disabled:opacity-50 flex items-center justify-center"
            >
              {loading ? "Searching..." : status !== "completed" ? <><Spinner /> Waiting...</> : "Search"}
            </button>
            <button
              onClick={downloadTranscript}
              disabled={!videoId}
              className="w-full mt-2 bg-green-600 py-2 rounded-lg text-white font-semibold hover:bg-green-700"
            >
              Download Transcript
            </button>
          </div>
        </div>

        {/* Middle Video */}
        {selectedVideo && (
          <div className="w-1/2 flex items-center justify-center">
            <div className="bg-gray-800 p-2 rounded-lg shadow-lg w-full h-full flex items-center justify-center">
              {selectedVideo.includes("youtube") ? (
                <iframe
                  src={toEmbedUrl(selectedVideo)}
                  title="Selected Video"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full rounded-lg"
                />
              ) : (
                <video
                  controls
                  key={selectedVideo}
                  className="w-full h-full rounded-lg"
                  src={selectedVideo}
                />
              )}
            </div>
          </div>
        )}

        {/* Right Library */}
        <div className={`${selectedVideo ? "w-1/4" : "w-1/2"} bg-white p-8 rounded-2xl shadow-2xl`}>
          <h2 className="text-2xl font-semibold mb-4 text-black">Library</h2>
          <Library libraryVideos={libraryVideos.slice(0, 5)} setSelectedVideo={setSelectedVideo} />
          {libraryVideos.length > 5 && (
            <button
              onClick={() => navigate("/library")}
              className="mt-2 text-blue-600 underline hover:text-blue-800"
            >
              See More
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------- ResultsPage ----------------
function ResultsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { selectedVideo, results: initialResults = [] } = location.state || {};
  const [results, setResults] = useState(initialResults);
  const [activeVideoTime, setActiveVideoTime] = useState(null);

  React.useEffect(() => {
    if (location.state?.results) {
      setResults(location.state.results);
    }
  }, [location.state?.results]);

  if (!selectedVideo) return navigate("/");

  const handleGoTo = (time, idx) => {
    setActiveVideoTime(idx);
  };

  return (
    <div className="min-h-screen bg-gray-200 px-6 py-8 flex flex-col items-center">
      <h1 className="text-4xl text-black font-bold mb-8 text-center">Search Results</h1>
      <div className="flex flex-col w-full max-w-4xl gap-4">
        {results.map((res, idx) => (
          <div key={idx} className="bg-white p-4 rounded-xl shadow-lg flex flex-col gap-2">
            <p className="text-sm text-gray-500">Timestamp: {formatTime(res.time)}</p>
            <p className="text-black font-medium">Snippet: {res.snippet}</p>
            <button
              onClick={() => handleGoTo(res.time, idx)}
              className="mt-2 bg-blue-600 text-white py-1 px-3 rounded hover:bg-blue-700 w-fit"
            >
              play this segment
            </button>

            {activeVideoTime === idx && (
              selectedVideo.includes("youtube") ? (
                <iframe
                  key={idx}
                  src={toEmbedUrl(selectedVideo, res.time)}
                  title={`video-${idx}`}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
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
        {results.length === 0 && (
          <p className="text-gray-600 text-center">Waiting for search results...</p>
        )}
        <button
          onClick={() => navigate("/")}
          className="mt-4 bg-gray-600 text-white py-2 px-6 rounded hover:bg-gray-700 w-fit"
        >
          Back to Upload
        </button>
      </div>
    </div>
  );
}

// ---------------- LibraryPage ----------------
function LibraryPage({ libraryVideos, setLibraryVideos }) {
  const [editableTitles, setEditableTitles] = useState(libraryVideos.map(v => v.title));
  const [isEditing, setIsEditing] = useState(null);
  const [showQueries, setShowQueries] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [activeVideoIndex, setActiveVideoIndex] = useState(null);

  const handleTitleChange = (idx, newTitle) => {
    setEditableTitles(prev => {
      const copy = [...prev];
      copy[idx] = newTitle;
      return copy;
    });
    setLibraryVideos(prev => prev.map((v, i) => i === idx ? { ...v, title: newTitle } : v));
  };

  const handleVideoClick = (videoUrl, index) => {
    setSelectedVideo(videoUrl);
    setActiveVideoIndex(index);
  };

  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-200 px-6 py-8">
      <h1 className="text-4xl text-black font-bold mb-8 text-center">Library</h1>
      <div className="max-w-4xl mx-auto flex flex-col gap-3">
        {libraryVideos.map((video, idx) => (
          <div key={idx} className="bg-white p-4 rounded-2xl shadow-lg flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleVideoClick(video.url, idx)}>
                {isEditing === idx ? (
                  <input
                    type="text"
                    value={editableTitles[idx]}
                    onChange={(e) => handleTitleChange(idx, e.target.value)}
                    className="text-black font-medium border-b border-gray-300 focus:outline-none"
                  />
                ) : (
                  <span className="text-xl mt-4 mx-4">{editableTitles[idx]}</span>
                )}
              </div>

              <button
                onClick={() => setIsEditing(isEditing === idx ? null : idx)}
                className="text-gray-600 ml-2"
              >
                <FiEdit className="text-lg" />
              </button>
            </div>

            <div className="flex justify-end mt-2">
              <button
                onClick={() => setShowQueries(!showQueries)}
                className="text-blue-600"
              >
                {showQueries ? "Hide Queries" : "Show Queries"}
              </button>
            </div>

            {showQueries && video.queries && video.queries.length > 0 && (
              <p className="text-gray-600 text-sm mt-2">Queries: {video.queries.join(", ")}</p>
            )}

            {activeVideoIndex === idx && selectedVideo && (
              <div className="w-full mt-4">
                <div className="bg-gray-800 p-2 rounded-lg shadow-lg w-full h-64 flex items-center justify-center">
                  {selectedVideo.includes("youtube") ? (
                    <iframe
                      src={`https://www.youtube.com/embed/${selectedVideo.split("v=")[1]}`}
                      title="Selected Video"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full h-full rounded-lg"
                    />
                  ) : (
                    <video
                      controls
                      className="w-full h-full rounded-lg"
                      src={selectedVideo}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        <button
          onClick={() => navigate("/")}
          className="mt-4 bg-gray-600 text-white py-2 px-6 rounded hover:bg-gray-700"
        >
          Back to Upload
        </button>
      </div>
    </div>
  );
}

// ---------------- Root App ----------------
export default function App() {
  const [query, setQuery] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoFile, setVideoFile] = useState(null);
  const [videoId, setVideoId] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);
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
        <Route path="/" element={
          <AppContent
            query={query} setQuery={setQuery}
            videoUrl={videoUrl} setVideoUrl={setVideoUrl}
            videoFile={videoFile} setVideoFile={setVideoFile}
            videoId={videoId} setVideoId={setVideoId}
            selectedVideo={selectedVideo} setSelectedVideo={setSelectedVideo}
            loading={loading} setLoading={setLoading}
            status={status} setStatus={setStatus}
            libraryVideos={libraryVideos} setLibraryVideos={setLibraryVideos}
          />
        } />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/library" element={
          <LibraryPage
            libraryVideos={libraryVideos} setLibraryVideos={setLibraryVideos}
          />
        } />
      </Routes>
    </Router>
  );
}
