import os
import tempfile
import subprocess
import yt_dlp
from whisper import load_model

# Load Whisper model (base, can switch to small/medium/large)
model = load_model("base")

def download_audio(youtube_url: str) -> str:
    """Download best audio from YouTube and return file path"""
    temp_dir = tempfile.gettempdir()
    ydl_opts = {
        "format": "bestaudio[ext=m4a]/bestaudio/best",
        "outtmpl": os.path.join(temp_dir, "%(id)s.%(ext)s"),
        "quiet": True,
        "no_warnings": True,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(youtube_url, download=True)
        audio_file = ydl.prepare_filename(info)
    return audio_file

def convert_to_wav(audio_path: str) -> str:
    """Convert any audio file to WAV format suitable for Whisper"""
    wav_path = os.path.splitext(audio_path)[0] + ".wav"
    subprocess.run([
        "ffmpeg", "-i", audio_path, "-ar", "16000", "-ac", "1", wav_path, "-y"
    ], check=True)
    return wav_path

def fetch_transcript(youtube_url: str):
    """
    Download YouTube audio, convert to WAV, and transcribe with Whisper.
    Returns a list of segments with start/end times and text.
    """
    try:
        audio_file = download_audio(youtube_url)
        wav_file = convert_to_wav(audio_file)

        print(f"Transcribing audio: {wav_file}")
        
        # Use better compute type if available
        import torch
        compute_type = "float16" if torch.cuda.is_available() else "float32"
        
        # Optimize transcription with better parameters
        result = model.transcribe(
            wav_file,
            fp16=torch.cuda.is_available(),  # Use fp16 if GPU available
            language='en',  # Specify language for better accuracy
            task='transcribe',
            best_of=1,  # Reduce beam search for speed
            beam_size=1,
            temperature=0.0,  # Reduce randomness
            compression_ratio_threshold=2.4,
            condition_on_previous_text=True,
            initial_prompt="This is a lecture video."  # Help with context
        )

        # Clean up temporary files
        try:
            os.remove(audio_file)
            os.remove(wav_file)
        except Exception as e:
            print(f"Warning: Failed to clean up temp files: {e}")

        # Process segments in batches
        segments = []
        batch = []
        for seg in result["segments"]:
            # Clean and normalize text
            text = seg["text"].strip()
            if text:  # Only add non-empty segments
                batch.append({
                    "start": seg["start"],
                    "end": seg["end"],
                    "text": text
                })
                
                # Process in batches of 32
                if len(batch) >= 32:
                    segments.extend(batch)
                    batch = []
        
        # Add remaining segments
        if batch:
            segments.extend(batch)
            
        return segments
        
    except Exception as e:
        print(f"Error in fetch_transcript: {str(e)}")
        raise
