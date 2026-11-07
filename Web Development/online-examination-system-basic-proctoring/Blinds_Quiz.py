import speech_recognition as sr
import time
import os
import sys
from camera_rec import VideoRecorder
import pyttsx3

class QuizEngine:
    def __init__(self):
        self.recognizer = sr.Recognizer()
        self.questions = []
        self.results_file = os.path.join(os.path.dirname(__file__), "results.txt")
        self.questions_file = os.path.join(os.path.dirname(__file__), "questions.txt")
        self.recorder = None
        self.engine = pyttsx3.init()  # Initialize pyttsx3 engine

    def speak(self, text):
        """Speak text using pyttsx3"""
        try:
            self.engine.say(text)
            self.engine.runAndWait()
        except Exception as e:
            print(f"Error in speech synthesis: {e}")

    def recognize_speech(self, timeout=5):
        """Listen to microphone and return recognized text"""
        try:
            with sr.Microphone() as source:
                print("Listening...")
                self.recognizer.adjust_for_ambient_noise(source, duration=0.5)
                audio = self.recognizer.listen(source, timeout=timeout, phrase_time_limit=10)

            user_response = self.recognizer.recognize_google(audio).lower()
            print(f"Recognized: {user_response}")

            if user_response == "quit":
                self.speak("Test is completed. Thank you!")
                time.sleep(2)
                self.cleanup()
                sys.exit(0)

            return user_response
        except sr.WaitTimeoutError:
            print("Listening timed out")
            return "timeout"
        except sr.UnknownValueError:
            print("Could not understand audio")
            return "unknown"
        except sr.RequestError as e:
            print(f"Could not request results: {e}")
            return "error"
        except Exception as e:
            print(f"Error in speech recognition: {e}")
            return "error"

    def ask_question(self, question):
        """Ask a question and return the response"""
        self.speak(question)
        return self.recognize_speech()

    def load_questions(self):
        """Load questions from file"""
        if not os.path.exists(self.questions_file):
            raise FileNotFoundError(f"Questions file not found at {self.questions_file}")

        with open(self.questions_file, "r") as f:
            self.questions = [line.strip() for line in f if line.strip()]

    def initialize_results(self):
        """Initialize results file"""
        with open(self.results_file, "w") as f:
            f.write("Quiz Results\n")
            f.write("=" * 50 + "\n")

    def record_answer(self, question_num, answer):
        """Record answer to results file"""
        with open(self.results_file, "a") as f:
            f.write(f"Question {question_num}: {answer}\n")

    def cleanup(self):
        """Clean up resources"""
        try:
            if os.path.exists("quiz_question.mp3"):
                os.remove("quiz_question.mp3")
        except PermissionError:
            print(f"Warning: Could not delete quiz_question.mp3 due to file lock.")
        if self.recorder:
            self.recorder.stop_recording()

    def run_quiz(self):
        """Main quiz execution"""
        try:
            self.load_questions()
            self.initialize_results()

            self.recorder = VideoRecorder("quiz_recording.avi")
            self.recorder.start_recording()

            for i, question in enumerate(self.questions, start=1):
                print(f"\nQuestion {i}: {question}")
                answer = self.ask_question(question)

                if answer == "skip":
                    print("Skipping question...")
                    self.speak("Skipping this question.")
                    time.sleep(1)
                    continue

                print(f"Your answer: {answer}")
                self.record_answer(i, answer)

                # Wait for next command
                while True:
                    self.speak("Say 'next' to continue or 'skip' to skip next question")
                    command = self.recognize_speech()

                    if command == "next":
                        break
                    elif command == "skip":
                        break
                    else:
                        self.speak("Sorry, I didn't understand. Please say 'next' or 'skip'")

                    time.sleep(1)

                if command == "skip":
                    continue

            self.speak("Test is completed. Thank you for participating!")
            time.sleep(2)

        except Exception as e:
            print(f"Error during quiz: {e}")
            raise
        finally:
            self.cleanup()


def main():
    quiz = QuizEngine()
    quiz.run_quiz()


if __name__ == "__main__":
    main()
