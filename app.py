from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
from pypdf import PdfReader
from docx import Document
import requests
import os
import json
import time
import re

load_dotenv()
app = Flask(__name__)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = "gemini-3.5-flash-lite"
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"


def call_gemini(prompt, json_mode=False):
    """Call Gemini and return generated text or a readable error."""
    if not GEMINI_API_KEY:
        return False, "GEMINI_API_KEY was not found in your .env file."

    headers = {"Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY}
    generation_config = {"temperature": 0.4}
    if json_mode:
        generation_config["responseMimeType"] = "application/json"

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": generation_config
    }

    for attempt in range(2):
        try:
            response = requests.post(GEMINI_URL, headers=headers, json=payload, timeout=45)
            try:
                body = response.json()
            except ValueError:
                body = {"error": {"message": response.text or "Unknown API response"}}

            if response.status_code == 200:
                try:
                    parts = body["candidates"][0]["content"]["parts"]
                    text = "\n".join(part.get("text", "") for part in parts).strip()
                    if not text:
                        return False, "Gemini returned an empty answer. Please try again."
                    return True, text
                except (KeyError, IndexError, TypeError):
                    return False, "Gemini returned an unexpected response. Please try again."

            message = body.get("error", {}).get("message", "") if isinstance(body, dict) else str(body)
            if response.status_code in (500, 502, 503, 504):
                if attempt == 0:
                    time.sleep(1.5)
                    continue
                return False, "Gemini is temporarily busy. Please try again in a few seconds."
            if response.status_code == 429:
                return False, "Gemini API rate limit reached. Wait a little and try again."
            if response.status_code in (401, 403):
                return False, "Gemini API key is invalid or does not have permission to use this API."
            if response.status_code == 404:
                return False, f"Gemini model '{GEMINI_MODEL}' is not available for this API key. Check the model name in app.py."
            return False, message or f"Gemini request failed (HTTP {response.status_code})."
        except requests.exceptions.Timeout:
            if attempt == 0:
                continue
            return False, "Gemini took too long to respond. Please try again."
        except requests.exceptions.RequestException:
            if attempt == 0:
                time.sleep(1)
                continue
            return False, "Could not connect to Gemini. Check your internet connection."
        except Exception as exc:
            print("Gemini error:", repr(exc))
            return False, "An unexpected error occurred while contacting Gemini."
    return False, "Gemini request failed. Please try again."


def parse_json_response(text):
    """Parse JSON even if a model accidentally wraps it in markdown fences."""
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end > start:
            return json.loads(text[start:end + 1])
        start = text.find("[")
        end = text.rfind("]")
        if start != -1 and end > start:
            return json.loads(text[start:end + 1])
        raise


def clean_text(value):
    if isinstance(value, list):
        return "\n".join(str(item) for item in value)
    if value is None:
        return ""
    return str(value).strip()


def generate_diagram(question):
    q = question.lower()
    diagrams = [
        (("photosynthesis",), """<div class=\"diagram-box\"><div class=\"diagram-node\">☀️ Sunlight</div><div class=\"diagram-arrow\">↓</div><div class=\"diagram-row\"><div class=\"diagram-node\">💧 Water</div><div class=\"diagram-plus\">+</div><div class=\"diagram-node\">🌫️ Carbon dioxide</div></div><div class=\"diagram-arrow\">↓</div><div class=\"diagram-main\">🌿 Green plant</div><div class=\"diagram-arrow\">↓</div><div class=\"diagram-row\"><div class=\"diagram-result\">🍬 Glucose</div><div class=\"diagram-plus\">+</div><div class=\"diagram-result\">💨 Oxygen</div></div></div>"""),
        (("water cycle",), """<div class=\"diagram-box\"><div class=\"diagram-node\">☀️ Sun heats water</div><div class=\"diagram-arrow\">↓</div><div class=\"diagram-node\">💧 Evaporation</div><div class=\"diagram-arrow\">↓</div><div class=\"diagram-node\">☁️ Condensation</div><div class=\"diagram-arrow\">↓</div><div class=\"diagram-node\">🌧️ Precipitation</div><div class=\"diagram-arrow\">↓</div><div class=\"diagram-result\">🌊 Collection</div></div>"""),
        (("food chain",), """<div class=\"diagram-box\"><div class=\"diagram-row\"><div class=\"diagram-node\">🌱 Plant</div><div class=\"diagram-arrow-side\">→</div><div class=\"diagram-node\">🐛 Insect</div><div class=\"diagram-arrow-side\">→</div><div class=\"diagram-node\">🐸 Frog</div><div class=\"diagram-arrow-side\">→</div><div class=\"diagram-node\">🐍 Snake</div></div></div>"""),
        (("database", "dbms", "sql"), """<div class=\"diagram-box\"><div class=\"diagram-node\">👤 User</div><div class=\"diagram-arrow\">↓</div><div class=\"diagram-node\">💻 Application / SQL query</div><div class=\"diagram-arrow\">↓</div><div class=\"diagram-node\">🗄️ DBMS</div><div class=\"diagram-arrow\">↓</div><div class=\"diagram-result\">📊 Database records</div></div>"""),
        (("network", "networking", "internet"), """<div class=\"diagram-box\"><div class=\"diagram-row\"><div class=\"diagram-node\">💻 Device</div><div class=\"diagram-arrow-side\">→</div><div class=\"diagram-node\">📡 Router</div><div class=\"diagram-arrow-side\">→</div><div class=\"diagram-node\">🌐 Internet</div><div class=\"diagram-arrow-side\">→</div><div class=\"diagram-node\">🖥️ Server</div></div></div>"""),
        (("python",), """<div class=\"diagram-box\"><div class=\"diagram-node\">⌨️ Python code</div><div class=\"diagram-arrow\">↓</div><div class=\"diagram-node\">⚙️ Interpreter</div><div class=\"diagram-arrow\">↓</div><div class=\"diagram-node\">🧠 Program execution</div><div class=\"diagram-arrow\">↓</div><div class=\"diagram-result\">📤 Output</div></div>"""),
        (("machine learning", "artificial intelligence", " ai "), """<div class=\"diagram-box\"><div class=\"diagram-node\">📊 Training data</div><div class=\"diagram-arrow\">↓</div><div class=\"diagram-node\">🧠 Learning algorithm</div><div class=\"diagram-arrow\">↓</div><div class=\"diagram-node\">🎯 Trained model</div><div class=\"diagram-arrow\">↓</div><div class=\"diagram-result\">📈 Prediction</div></div>""")
    ]
    for keywords, html in diagrams:
        if any(keyword in q for keyword in keywords):
            return html
    return """<div class=\"diagram-box\"><div class=\"diagram-node\">📚 Topic</div><div class=\"diagram-arrow\">↓</div><div class=\"diagram-node\">🧠 Main concept</div><div class=\"diagram-arrow\">↓</div><div class=\"diagram-node\">📝 Important points</div><div class=\"diagram-arrow\">↓</div><div class=\"diagram-result\">💡 Example / application</div></div>"""


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/ask", methods=["POST"])
def ask():
    data = request.get_json(silent=True) or {}
    question = clean_text(data.get("question"))
    if not question:
        return jsonify(success=False, error="Please enter a question."), 400

    prompt = f'''You are an expert AI Smart Study Assistant. Answer this student question: {question}
Return ONLY a valid JSON object with exactly these fields:
{{
  "key_points": ["4 to 6 short useful points"],
  "mark2": "A concise exam-ready answer around 30-50 words",
  "mark8": "A well-organized exam answer around 150-250 words, with headings or paragraphs where useful",
  "mark16": "A detailed exam-ready answer around 350-500 words, with introduction, headings, examples and conclusion where relevant"
}}
Rules: Use simple accurate English. Make all four sections about the exact topic. Do not include markdown code fences. JSON strings must be valid; represent line breaks as \\n. Do not include a diagram field.'''
    ok, result = call_gemini(prompt, json_mode=True)
    if not ok:
        return jsonify(success=False, error=result), 503
    try:
        parsed = parse_json_response(result)
        key_points = parsed.get("key_points", [])
        if isinstance(key_points, str):
            key_points = [line.strip(" •-\t") for line in key_points.splitlines() if line.strip()]
        if not isinstance(key_points, list):
            key_points = [str(key_points)]
        answer = {
            "success": True,
            "key_points": [clean_text(item) for item in key_points if clean_text(item)],
            "mark2": clean_text(parsed.get("mark2")),
            "mark8": clean_text(parsed.get("mark8")),
            "mark16": clean_text(parsed.get("mark16")),
            "diagram": generate_diagram(question)
        }
        if not answer["mark2"] or not answer["mark8"] or not answer["mark16"]:
            return jsonify(success=False, error="Gemini returned incomplete answer sections. Please try again."), 502
        return jsonify(answer)
    except (ValueError, TypeError, AttributeError) as exc:
        print("Could not parse answer JSON:", repr(exc), "Response:", result[:1000])
        return jsonify(success=False, error="The AI returned an unexpected format. Please click Ask AI again."), 502


@app.route("/summarize", methods=["POST"])
def summarize():
    if "file" not in request.files:
        return jsonify(success=False, summary="Please choose a file first."), 400
    file = request.files["file"]
    if not file or not file.filename:
        return jsonify(success=False, summary="Please choose a file first."), 400

    filename = file.filename.lower()
    try:
        if filename.endswith(".txt"):
            text = file.read().decode("utf-8", errors="ignore")
        elif filename.endswith(".pdf"):
            reader = PdfReader(file)
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
        elif filename.endswith(".docx"):
            document = Document(file)
            text = "\n".join(p.text for p in document.paragraphs if p.text.strip())
        else:
            return jsonify(success=False, summary="Supported file types are TXT, PDF and DOCX."), 400
    except Exception as exc:
        print("File reading error:", repr(exc))
        return jsonify(success=False, summary="Could not read this file. Please check that it is a valid TXT, PDF or DOCX file."), 400

    text = text.strip()
    if not text:
        return jsonify(success=False, summary="No readable text was found in the file."), 400
    text = text[:25000]
    prompt = f'''You are an AI study assistant. Summarize these study notes in simple English.
Return ONLY valid JSON with fields:
{{"summary":"A clear structured study summary with headings and paragraphs","key_points":["5 to 8 key points"]}}
Do not use markdown code fences.
STUDY NOTES:\n{text}'''
    ok, result = call_gemini(prompt, json_mode=True)
    if not ok:
        return jsonify(success=False, summary=result), 503
    try:
        parsed = parse_json_response(result)
        points = parsed.get("key_points", [])
        if isinstance(points, str):
            points = [line.strip(" •-\t") for line in points.splitlines() if line.strip()]
        if not isinstance(points, list):
            points = [str(points)]
        return jsonify(success=True, summary=clean_text(parsed.get("summary")), key_points=[clean_text(p) for p in points if clean_text(p)])
    except (ValueError, TypeError, AttributeError):
        return jsonify(success=True, summary=result, key_points=[])


@app.route("/quiz", methods=["POST"])
def quiz():
    data = request.get_json(silent=True) or {}
    topic = clean_text(data.get("topic"))
    if not topic:
        return jsonify(success=False, error="Please enter a quiz topic."), 400

    prompt = f'''Create exactly 5 multiple-choice quiz questions about: {topic}
Return ONLY valid JSON in this exact structure:
{{
 "questions": [
  {{"question":"Question text","options":["Option A","Option B","Option C","Option D"],"answer":0,"explanation":"Short explanation"}}
 ]
}}
Rules:
- Exactly 5 questions.
- Each question has exactly 4 options.
- correct_answer is a zero-based integer: 0, 1, 2, or 3.
- There is only one correct answer per question.
- Use simple English and factual answers.
- Do not show answers in the question or options.
- Do not use markdown code fences.'''
    ok, result = call_gemini(prompt, json_mode=True)
    if not ok:
        return jsonify(success=False, error=result), 503
    try:
        parsed = parse_json_response(result)
        questions = parsed.get("questions", parsed if isinstance(parsed, list) else [])
        if not isinstance(questions, list) or len(questions) != 5:
            raise ValueError("Expected exactly five questions")
        cleaned = []
        for item in questions:
            if not isinstance(item, dict):
                raise ValueError("Invalid question")
            options = item.get("options", [])
            if not isinstance(options, list) or len(options) != 4:
                raise ValueError("Each question must have four options")
            correct = item.get("answer", item.get("correct_answer", 0))
            if isinstance(correct, str):
                if correct.strip().upper() in ("A", "B", "C", "D"):
                    correct = ord(correct.strip().upper()) - ord("A")
                else:
                    correct = int(correct)
            correct = int(correct)
            if correct not in (0, 1, 2, 3):
                raise ValueError("Invalid correct answer index")
            cleaned.append({
                "question": clean_text(item.get("question")),
                "options": [clean_text(option) for option in options],
                "answer": correct,
                "explanation": clean_text(item.get("explanation"))
            })
        return jsonify(success=True, questions=cleaned)
    except (ValueError, TypeError, AttributeError, KeyError) as exc:
        print("Quiz JSON parsing/validation error:", repr(exc), "Response:", result[:1500])
        return jsonify(success=False, error="The AI returned an invalid quiz format. Please generate the quiz again."), 502


if __name__ == "__main__":
    print("=" * 56)
    print("AI SMART STUDY ASSISTANT")
    print(f"Gemini model: {GEMINI_MODEL}")
    print("Gemini API key:", "FOUND" if GEMINI_API_KEY else "NOT FOUND")
    print("Running at http://127.0.0.1:5000")
    print("=" * 56)
    app.run(debug=True, host="127.0.0.1", port=5000)
