# AI Smart Study Assistant

A web app that helps students study smarter using AI. Built with Flask and the Gemini API.

## Features
- **Summarize Notes**: upload a TXT, PDF or DOCX file and get a structured summary with key points
- **Ask a Question**: key points plus 2, 8 and 16 mark exam-style answers, with a related diagram
- **Generate a Quiz**: 5 multiple-choice questions with scoring and an answer review
- **Read Aloud**: the browser reads summaries, answers and quiz questions, with a Stop button
- **Download Answer**: save the AI answer as a text file

## Tech Stack
Python, Flask, Gemini API, HTML, CSS, JavaScript, pypdf, python-docx

## Run Locally
1. Clone the repo
2. Create a virtual environment: `python -m venv .venv`
3. Activate it: `.venv\Scripts\activate` on Windows
4. Install packages: `pip install -r requirements.txt`
5. Create a `.env` file containing: `GEMINI_API_KEY=your_key_here`
6. Run: `python app.py`
7. Open `http://127.0.0.1:5000`