import subprocess
import threading
import time

class VideoRecorder:
    def __init__(self, output_file="recording.mp4"):
        self.output_file = output_file
        self.process = None
        self.recording_thread = None
        self.ffmpeg_path = "C:\\Users\\Pavan\\Downloads\\ffmpeg\\ffmpeg-7.1.1-essentials_build\\bin\\ffmpeg.exe"
        self.video_device = "Integrated Camera"
        self.audio_device = "Microphone Array (Intel® Smart Sound Technology for Digital Microphones)"

    def _record_video(self):
        """Start FFmpeg recording process"""
        command = [
            self.ffmpeg_path,
            "-y",
            "-f", "dshow",
            "-i", f"video={self.video_device}:audio={self.audio_device}",
            "-vcodec", "libx264",
            "-preset", "ultrafast",
            "-crf", "23",
            "-pix_fmt", "yuv420p",
            self.output_file
        ]

        try:
            self.process = subprocess.Popen(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception as e:
            print(f"Failed to start FFmpeg process: {e}")
            self.process = None

    def start_recording(self):
        """Start recording in a background thread"""
        if self.process:
            print("Recording already in progress.")
            return

        print("Starting recording...")
        self.recording_thread = threading.Thread(target=self._record_video)
        self.recording_thread.daemon = True
        self.recording_thread.start()
        time.sleep(2)  # Allow FFmpeg to initialize

    def stop_recording(self):
        """Stop the FFmpeg recording process"""
        if self.process:
            print("Stopping recording...")
            self.process.terminate()
            self.process.wait()
            self.process = None
            print("Recording stopped.")

    def __del__(self):
        """Ensure recording is stopped on cleanup"""
        self.stop_recording()
