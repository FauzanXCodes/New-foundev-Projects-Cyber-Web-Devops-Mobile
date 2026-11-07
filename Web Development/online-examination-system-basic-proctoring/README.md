# 📚 Audio-Based Online Examination & Proctoring System

Audio-Based Online Examination & Proctoring System is a Python-based application designed to conduct hands-free assessments using voice interaction. It integrates speech recognition and text-to-speech technologies to automate the examination process, along with webcam-based monitoring for basic proctoring.

---

## 🎯 Features

* 🎤 Voice-based answer input using Speech Recognition
* 🔊 Automated question delivery using Text-to-Speech
* 🎥 Real-time webcam monitoring and recording
* 🧠 Automated question sequencing and evaluation
* 🖥️ GUI-based interface using Tkinter
* ⚡ Continuous quiz flow with minimal manual intervention

---

## 🏢 Tech Stack

* ⚙️ Backend : Python
* 🎨 Interface : Tkinter (GUI)
* 🟢 Libraries : SpeechRecognition, pyttsx3, OpenCV, FFmpeg
* 🎥 Proctoring : Webcam (OpenCV / FFmpeg)

---

## 🏰 Installation Guide

### 1. Prerequisites

* 🐍 Python 3.x
* 🎥 Webcam
* 🎤 Microphone

---

### 2. Setup Instructions

* 💽 Download and extract the project files
* 📦 Install required libraries:

pip install opencv-python speechrecognition pyttsx3 pyaudio

* ⚠️ If PyAudio fails:

pip install pipwin
pipwin install pyaudio

* ▶️ Ensure webcam and microphone permissions are enabled

---

## 🎭 How to Use

### ▶️ Run the Application

📌 Open terminal in project folder:

python Quiz_GUI.py

---

### 🎤 Exam Flow

* System launches GUI interface
* Questions are delivered via voice
* User responds using microphone
* Answers are processed automatically
* Webcam records candidate activity during exam

---

### 🎥 Proctoring

* Webcam starts automatically during exam
* Candidate activity is monitored and recorded
* Ensures basic transparency during assessment

---

## 📊 Use Case

* Accessibility-focused examinations
* Hands-free assessment environments
* Basic remote proctoring systems
* Educational and training platforms

---

## ⚠️ Limitations

* Sensitive to background noise during speech input
* Requires proper microphone configuration
* Basic proctoring (no AI-based cheating detection)
* Device-dependent setup

---

## 💡 Acknowledgements

* [SpeechRecognition](https://pypi.org/project/SpeechRecognition/) – Voice input processing
* [pyttsx3](https://pypi.org/project/pyttsx3/) – Text-to-speech engine
* [OpenCV](https://opencv.org/) – Webcam handling
* [FFmpeg](https://ffmpeg.org/) – Video recording support
* [Tkinter](https://docs.python.org/3/library/tkinter.html) – GUI framework
* [Open-Source Community](https://opensource.org/) – Support & inspiration
