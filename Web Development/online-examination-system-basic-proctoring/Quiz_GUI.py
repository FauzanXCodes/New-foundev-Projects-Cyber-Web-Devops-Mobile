import tkinter as tk
import threading
from tkinter import messagebox
from Blinds_Quiz import main as start_quiz

class QuizApplication:
    def __init__(self, root):
        self.root = root
        self.root.title("Quiz Application")
        self.root.geometry("500x300")
        self.quiz_thread = None
        
        self.create_widgets()
        
    def create_widgets(self):
        # Main frame
        main_frame = tk.Frame(self.root, padx=20, pady=20)
        main_frame.pack(expand=True, fill=tk.BOTH)
        
        # Title
        tk.Label(main_frame, text="Quiz Application", font=("Arial", 16, "bold")).pack(pady=10)
        
        # Instructions frame
        instructions_frame = tk.Frame(main_frame)
        instructions_frame.pack(pady=10)
        
        instructions = [
            "Welcome to the Quiz Application!",
            "To Start the Test Click on Start",
            "To Quit at any time please say 'quit'",
            "To Skip any question say 'skip'",
            "To proceed to next question say 'next'"
        ]
        
        for text in instructions:
            tk.Label(instructions_frame, text=text, anchor="w").pack(fill=tk.X, pady=2)
        
        # Button frame
        button_frame = tk.Frame(main_frame)
        button_frame.pack(pady=20)
        
        # Start button
        tk.Button(button_frame, text="Start Quiz", command=self.start_quiz_thread,
                 width=15, bg="#4CAF50", fg="white").pack(side=tk.LEFT, padx=10)
        
        # Close button
        tk.Button(button_frame, text="Close", command=self.close_gui,
                 width=15, bg="#f44336", fg="white").pack(side=tk.LEFT, padx=10)
    
    def start_quiz_thread(self):
        if self.quiz_thread and self.quiz_thread.is_alive():
            messagebox.showwarning("Warning", "Quiz is already running!")
            return
            
        self.quiz_thread = threading.Thread(target=self.run_quiz)
        self.quiz_thread.daemon = True
        self.quiz_thread.start()
    
    def run_quiz(self):
        try:
            start_quiz()
        except Exception as e:
            messagebox.showerror("Error", f"An error occurred during the quiz:\n{str(e)}")
    
    def close_gui(self):
        if self.quiz_thread and self.quiz_thread.is_alive():
            if messagebox.askokcancel("Quit", "Quiz is still running. Are you sure you want to quit?"):
                self.root.destroy()
        else:
            self.root.destroy()

if __name__ == "__main__":
    root = tk.Tk()
    app = QuizApplication(root)
    root.mainloop()