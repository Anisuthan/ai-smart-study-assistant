// ============================================================
// AI SMART STUDY ASSISTANT - COMPLETE FRONTEND JAVASCRIPT
// ============================================================

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function getElement(id) {
    return document.getElementById(id);
}

function escapeHTML(text) {
    if (text === null || text === undefined) {
        return "";
    }

    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatText(text) {
    if (text === null || text === undefined) {
        return "";
    }

    let value = escapeHTML(text);

    value = value.replace(
        /\*\*(.*?)\*\*/g,
        "<strong>$1</strong>"
    );

    value = value.replace(
        /^###\s*(.*?)$/gm,
        "<h4>$1</h4>"
    );

    value = value.replace(
        /^##\s*(.*?)$/gm,
        "<h3>$1</h3>"
    );

    value = value.replace(
        /^#\s*(.*?)$/gm,
        "<h3>$1</h3>"
    );

    value = value.replace(
        /^\s*[-•]\s+(.*?)$/gm,
        "• $1"
    );

    value = value.replace(
        /^(\d+)\.\s+(.*?)$/gm,
        "$1. $2"
    );

    value = value.replace(/\n/g, "<br>");

    return value;
}

function showMessage(container, message, type = "error") {
    if (!container) {
        return;
    }

    container.innerHTML = `
        <div class="answer-card ${type}">
            ${formatText(message)}
        </div>
    `;
}

// ============================================================
// CLEAN AI RESPONSE
// ============================================================

function cleanAIResponse(data) {
    const result = data || {};

    if (
        result.key_points ||
        result.mark2 ||
        result.mark8 ||
        result.mark16
    ) {
        return result;
    }

    if (result.answer) {
        if (typeof result.answer === "object") {
            return {
                ...result.answer,
                diagram: result.diagram || result.answer.diagram || ""
            };
        }

        if (typeof result.answer === "string") {
            let cleaned = result.answer.trim();

            cleaned = cleaned
                .replace(/^```json\s*/i, "")
                .replace(/```$/i, "")
                .trim();

            try {
                const parsed = JSON.parse(cleaned);

                if (parsed && typeof parsed === "object") {
                    return {
                        ...parsed,
                        diagram: result.diagram || parsed.diagram || ""
                    };
                }
            } catch (error) {
                // Normal text response; parse below.
            }
        }
    }

    return {
        ...parseAnswerText(
            typeof result.answer === "string" ? result.answer : ""
        ),
        diagram: result.diagram || ""
    };
}

// ============================================================
// PARSE NORMAL AI ANSWER
// ============================================================

function parseAnswerText(text) {
    if (!text) {
        return {
            key_points: [],
            mark2: "",
            mark8: "",
            mark16: ""
        };
    }

    let keyPoints = [];
    let mark2 = "";
    let mark8 = "";
    let mark16 = "";

    const keyMatch = text.match(
        /(?:KEY POINTS|1\.\s*Key Points)\s*:?\s*([\s\S]*?)(?=\n\s*(?:2 MARK ANSWER|2\.\s*2 Mark Answer))/i
    );

    const mark2Match = text.match(
        /(?:2 MARK ANSWER|2\.\s*2 Mark Answer)\s*:?\s*([\s\S]*?)(?=\n\s*(?:8 MARK ANSWER|3\.\s*8 Mark Answer))/i
    );

    const mark8Match = text.match(
        /(?:8 MARK ANSWER|3\.\s*8 Mark Answer)\s*:?\s*([\s\S]*?)(?=\n\s*(?:16 MARK ANSWER|4\.\s*16 Mark Answer))/i
    );

    const mark16Match = text.match(
        /(?:16 MARK ANSWER|4\.\s*16 Mark Answer)\s*:?\s*([\s\S]*)$/i
    );

    if (keyMatch) {
        keyPoints = keyMatch[1]
            .split(/\n+/)
            .map(point =>
                point
                    .replace(/^\s*[-•*]\s*/, "")
                    .replace(/^\s*\d+[.)]\s*/, "")
                    .trim()
            )
            .filter(Boolean);
    }

    if (mark2Match) {
        mark2 = mark2Match[1].trim();
    }

    if (mark8Match) {
        mark8 = mark8Match[1].trim();
    }

    if (mark16Match) {
        mark16 = mark16Match[1].trim();
    }

    if (!keyPoints.length && !mark2 && !mark8 && !mark16) {
        mark16 = text.trim();
    }

    return {
        key_points: keyPoints,
        mark2,
        mark8,
        mark16
    };
}

// ============================================================
// ASK AI
// ============================================================

async function askQuestion() {
    const questionInput = getElement("question");
    const answerContainer = getElement("answer");

    if (!questionInput || !answerContainer) {
        return;
    }

    const question = questionInput.value.trim();

    if (!question) {
        showMessage(answerContainer, "Please enter a question.");
        return;
    }

    answerContainer.innerHTML = `
        <div class="answer-card">
            <h3>🤖 AI is thinking...</h3>
            <p>Please wait while your answer is prepared.</p>
        </div>
    `;

    try {
        const response = await fetch("/ask", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ question })
        });

        const data = await response.json();

        if (!response.ok) {
            showMessage(
                answerContainer,
                data.error || data.answer || "Could not get an answer."
            );
            return;
        }

        if (
            !data.answer &&
            !data.key_points &&
            !data.mark2 &&
            !data.mark8 &&
            !data.mark16
        ) {
            showMessage(
                answerContainer,
                data.error || "Could not get an answer."
            );
            return;
        }

        renderAnswer(data);

    } catch (error) {
        console.error(error);

        showMessage(
            answerContainer,
            "Could not connect to the server."
        );
    }
}

// ============================================================
// RENDER AI ANSWER
// ============================================================

function renderAnswer(data) {
    const answerContainer = getElement("answer");

    if (!answerContainer) {
        return;
    }

    const answer = cleanAIResponse(data);

    let html = `
        <div class="answer-card key-points-card">
            <div class="answer-card-title">💡 Key Points</div>
            <div class="answer-card-content">
    `;

    if (Array.isArray(answer.key_points) && answer.key_points.length) {
        html += `<ul class="key-points-list">`;

        answer.key_points.forEach(point => {
            html += `<li>${formatText(point)}</li>`;
        });

        html += `</ul>`;
    } else {
        html += `<p>Review the answer sections below for important points.</p>`;
    }

    html += `
            </div>
        </div>
    `;

    if (answer.mark2) {
        html += `
            <div class="answer-card mark2-card">
                <div class="answer-card-title">
                    <span class="mark-number">2</span>
                    <span>2 Mark Answer</span>
                </div>
                <div class="answer-card-content">
                    ${formatText(answer.mark2)}
                </div>
            </div>
        `;
    }

    if (answer.mark8) {
        html += `
            <div class="answer-card mark8-card">
                <div class="answer-card-title">
                    <span class="mark-number">8</span>
                    <span>8 Mark Answer</span>
                </div>
                <div class="answer-card-content">
                    ${formatText(answer.mark8)}
                </div>
            </div>
        `;
    }

    if (answer.mark16) {
        html += `
            <div class="answer-card mark16-card">
                <div class="answer-card-title">
                    <span class="mark-number">16</span>
                    <span>16 Mark Answer</span>
                </div>
                <div class="answer-card-content">
                    ${formatText(answer.mark16)}
                </div>
            </div>
        `;
    }

    if (answer.diagram) {
        html += `
            <div class="answer-card diagram-card">
                <div class="answer-card-title">📊 Related Diagram</div>
                <div class="answer-card-content">
                    ${answer.diagram}
                </div>
            </div>
        `;
    }

    if (!answer.mark2 && !answer.mark8 && !answer.mark16 && data.answer) {
        html += `
            <div class="answer-card mark16-card">
                <div class="answer-card-title">📖 Answer</div>
                <div class="answer-card-content">
                    ${formatText(data.answer)}
                </div>
            </div>
        `;
    }

    answerContainer.innerHTML = html;

    window.currentAnswer = answer;
}

// ============================================================
// DOWNLOAD ANSWER
// ============================================================

function downloadAnswer() {
    const data = window.currentAnswer;

    if (!data) {
        alert("Please ask a question first.");
        return;
    }

    let text = "AI SMART STUDY ASSISTANT\n";
    text += "=========================\n\n";

    text += "KEY POINTS\n";
    text += "----------\n";

    if (Array.isArray(data.key_points)) {
        data.key_points.forEach((point, index) => {
            text += `${index + 1}. ${point}\n`;
        });
    }

    text += "\n2 MARK ANSWER\n";
    text += "-------------\n";
    text += `${data.mark2 || ""}\n\n`;

    text += "8 MARK ANSWER\n";
    text += "-------------\n";
    text += `${data.mark8 || ""}\n\n`;

    text += "16 MARK ANSWER\n";
    text += "--------------\n";
    text += `${data.mark16 || ""}\n`;

    if (data.diagram) {
        text += "\nRELATED DIAGRAM\n";
        text += "---------------\n";
        text += data.diagram
            .replace(/<[^>]*>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        text += "\n";
    }

    const blob = new Blob([text], {
        type: "text/plain;charset=utf-8"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "AI_Study_Answer.txt";

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
}

// ============================================================
// SUMMARIZE NOTES
// ============================================================

async function summarizeNotes() {
    const fileInput = getElement("noteFile");
    const summaryContainer = getElement("summary");

    if (!fileInput || !summaryContainer) {
        return;
    }

    if (!fileInput.files || fileInput.files.length === 0) {
        showMessage(
            summaryContainer,
            "Please choose a TXT, PDF or DOCX file."
        );
        return;
    }

    const file = fileInput.files[0];
    const filename = file.name.toLowerCase();

    const allowedExtensions = [".txt", ".pdf", ".docx"];

    if (!allowedExtensions.some(ext => filename.endsWith(ext))) {
        showMessage(
            summaryContainer,
            "Only TXT, PDF and DOCX files are supported."
        );
        return;
    }

    summaryContainer.innerHTML = `
        <div class="answer-card">
            <h3>📚 Reading your notes...</h3>
            <p>Please wait while AI prepares your summary.</p>
        </div>
    `;

    const formData = new FormData();
    formData.append("file", file);

    try {
        const response = await fetch("/summarize", {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            showMessage(
                summaryContainer,
                data.summary || data.error || "Could not summarize the file."
            );
            return;
        }

        renderSummary(data);

    } catch (error) {
        console.error(error);

        showMessage(
            summaryContainer,
            "Could not connect to the server."
        );
    }
}

// ============================================================
// RENDER SUMMARY
// ============================================================

function renderSummary(data) {
    const container = getElement("summary");

    if (!container) {
        return;
    }

    let html = `
        <div class="answer-card key-points-card">
            <div class="answer-card-title">📚 Study Summary</div>
            <div class="answer-card-content">
                ${formatText(data.summary || "No summary returned.")}
            </div>
        </div>
    `;

    if (Array.isArray(data.key_points) && data.key_points.length) {
        html += `
            <div class="answer-card key-points-card">
                <div class="answer-card-title">💡 Key Points</div>
                <div class="answer-card-content">
                    <ul class="key-points-list">
        `;

        data.key_points.forEach(point => {
            html += `<li>${formatText(point)}</li>`;
        });

        html += `
                    </ul>
                </div>
            </div>
        `;
    }

    container.innerHTML = html;
}

// ============================================================
// QUIZ STATE
// ============================================================

let quizQuestions = [];
let selectedAnswers = [];
let quizSubmitted = false;

// ============================================================
// NORMALIZE QUIZ ANSWER
// ============================================================

function getCorrectAnswerIndex(question) {
    const answer = question.answer;

    if (typeof answer === "number") {
        return answer;
    }

    if (typeof answer === "string") {
        const trimmed = answer.trim().toUpperCase();

        // Accept answers such as A, B, C, D.
        if (/^[A-D]$/.test(trimmed)) {
            return trimmed.charCodeAt(0) - 65;
        }

        // Also accept numeric strings.
        if (/^\d+$/.test(trimmed)) {
            return Number(trimmed);
        }

        // Accept an answer matching the option text.
        if (Array.isArray(question.options)) {
            return question.options.findIndex(
                option =>
                    String(option).trim().toLowerCase() ===
                    trimmed.toLowerCase()
            );
        }
    }

    return -1;
}

// ============================================================
// GENERATE QUIZ
// ============================================================

async function generateQuiz() {
    const topicInput = getElement("quizTopic");
    const quizContainer = getElement("quiz");

    if (!topicInput || !quizContainer) {
        return;
    }

    const topic = topicInput.value.trim();

    if (!topic) {
        showMessage(quizContainer, "Please enter a quiz topic.");
        return;
    }

    quizContainer.innerHTML = `
        <div class="quiz-loading">
            <div class="quiz-loading-icon">🧠</div>
            <h3>Creating your quiz...</h3>
            <p>AI is preparing five questions for you.</p>
            <div class="loading-bar"><div></div></div>
        </div>
    `;

    try {
        const response = await fetch("/quiz", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ topic })
        });

        const data = await response.json();

        if (!response.ok) {
            showMessage(
                quizContainer,
                data.error || data.quiz || "Could not create the quiz."
            );
            return;
        }

        /*
         * This frontend expects the backend to return:
         *
         * {
         *   "questions": [
         *     {
         *       "question": "Question text",
         *       "options": ["Option A", "Option B", "Option C", "Option D"],
         *       "answer": 0,
         *       "explanation": "Explanation"
         *     }
         *   ]
         * }
         *
         * answer may be 0-3 or A-D.
         */

        if (!Array.isArray(data.questions) || data.questions.length === 0) {
            showMessage(
                quizContainer,
                data.quiz ||
                "The server did not return structured quiz questions. Please check the /quiz route in app.py."
            );
            return;
        }

        quizQuestions = data.questions
            .filter(question =>
                question &&
                typeof question.question === "string" &&
                Array.isArray(question.options) &&
                question.options.length >= 2
            )
            .slice(0, 5);

        if (!quizQuestions.length) {
            showMessage(
                quizContainer,
                "The quiz questions were not in the expected format. Please try again."
            );
            return;
        }

        selectedAnswers = new Array(quizQuestions.length).fill(null);
        quizSubmitted = false;

        renderAllQuizQuestions();

    } catch (error) {
        console.error(error);

        showMessage(
            quizContainer,
            "Could not connect to the server."
        );
    }
}

// ============================================================
// RENDER ALL QUIZ QUESTIONS
// ============================================================

function renderAllQuizQuestions() {
    const container = getElement("quiz");

    if (!container) {
        return;
    }

    const total = quizQuestions.length;

    let html = `
        <div class="beautiful-quiz">

            <div class="quiz-top">
                <div class="quiz-title-area">
                    <div class="quiz-main-icon">🧠</div>
                    <div>
                        <h2>Quick Knowledge Quiz</h2>
                        <p>Test your understanding and improve your skills.</p>
                    </div>
                </div>

                <div class="quiz-count">
                    <strong>${total}</strong>
                    <span>Questions</span>
                </div>
            </div>

            <div class="quiz-progress-area">
                <div class="quiz-progress-label">
                    <span>📊 Your Progress</span>
                    <span id="quizProgressText">0 / ${total} answered</span>
                </div>

                <div class="quiz-progress-track">
                    <div
                        id="quizProgressBar"
                        class="quiz-progress-fill"
                        style="width:0%"
                    ></div>
                </div>
            </div>

            <div class="quiz-instruction">
                <span>💡</span>
                <div>
                    <strong>Choose one answer for every question.</strong>
                    <p>Correct answers will be revealed after you submit the quiz.</p>
                </div>
            </div>

            <div class="quiz-question-list">
    `;

    quizQuestions.forEach((question, questionIndex) => {
        html += `
            <div class="quiz-question-card" id="quiz-question-${questionIndex}">
                <div class="question-top">
                    <div class="question-number">${questionIndex + 1}</div>
                    <div class="question-label">QUESTION ${questionIndex + 1}</div>
                </div>

                <h3 class="question-text">
                    ${escapeHTML(question.question)}
                </h3>

                <div class="quiz-options">
        `;

        question.options.forEach((option, optionIndex) => {
            const letter = String.fromCharCode(65 + optionIndex);

            html += `
                <button
                    type="button"
                    class="quiz-option"
                    data-question="${questionIndex}"
                    data-option="${optionIndex}"
                    onclick="selectQuizAnswer(${questionIndex}, ${optionIndex})"
                >
                    <span class="quiz-option-letter">${letter}</span>
                    <span class="quiz-option-text">${escapeHTML(option)}</span>
                    <span class="quiz-option-check">✓</span>
                </button>
            `;
        });

        html += `
                </div>

                <div
                    class="question-status"
                    id="question-status-${questionIndex}"
                >
                    Choose your answer
                </div>
            </div>
        `;
    });

    html += `
            </div>

            <div class="quiz-submit-area">
                <div class="quiz-submit-info">
                    <span class="submit-icon">🎯</span>
                    <div>
                        <strong>Ready to check your knowledge?</strong>
                        <p>Answer every question to reveal your score and answer review.</p>
                    </div>
                </div>

                <button
                    type="button"
                    class="quiz-submit-button"
                    id="submitQuizButton"
                    onclick="submitQuiz()"
                >
                    📝 Submit Quiz
                </button>
            </div>

        </div>
    `;

    container.innerHTML = html;

    updateQuizProgress();
}

// ============================================================
// SELECT QUIZ ANSWER
// ============================================================

function selectQuizAnswer(questionIndex, optionIndex) {
    if (quizSubmitted) {
        return;
    }

    if (
        questionIndex < 0 ||
        questionIndex >= quizQuestions.length
    ) {
        return;
    }

    selectedAnswers[questionIndex] = optionIndex;

    const questionCard = getElement(
        `quiz-question-${questionIndex}`
    );

    if (!questionCard) {
        return;
    }

    questionCard.querySelectorAll(".quiz-option").forEach(
        (button, index) => {
            button.classList.remove("selected");

            if (index === optionIndex) {
                button.classList.add("selected");
            }
        }
    );

    const status = getElement(
        `question-status-${questionIndex}`
    );

    if (status) {
        status.textContent = "✓ Answer selected";
        status.classList.add("answered");
    }

    updateQuizProgress();
}

// ============================================================
// UPDATE PROGRESS
// ============================================================

function updateQuizProgress() {
    const answered = selectedAnswers.filter(
        answer => answer !== null
    ).length;

    const total = quizQuestions.length;

    const percentage = total
        ? (answered / total) * 100
        : 0;

    const progressBar = getElement("quizProgressBar");
    const progressText = getElement("quizProgressText");

    if (progressBar) {
        progressBar.style.width = `${percentage}%`;
    }

    if (progressText) {
        progressText.textContent = `${answered} / ${total} answered`;
    }

    const submitButton = getElement("submitQuizButton");

    if (submitButton) {
        if (answered === total) {
            submitButton.classList.add("ready");
            submitButton.innerHTML = "✓ Submit Quiz";
        } else {
            submitButton.classList.remove("ready");
            submitButton.innerHTML = "📝 Submit Quiz";
        }
    }
}

// ============================================================
// SUBMIT QUIZ
// ============================================================

function submitQuiz() {
    if (!quizQuestions.length || quizSubmitted) {
        return;
    }

    const unansweredIndex = selectedAnswers.indexOf(null);

    if (unansweredIndex !== -1) {
        alert(
            `Please answer all ${quizQuestions.length} questions before submitting.`
        );

        const card = getElement(
            `quiz-question-${unansweredIndex}`
        );

        if (card) {
            card.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
        }

        return;
    }

    quizSubmitted = true;

    let score = 0;

    quizQuestions.forEach((question, index) => {
        const correctIndex = getCorrectAnswerIndex(question);

        if (Number(selectedAnswers[index]) === correctIndex) {
            score++;
        }
    });

    showQuizResults(score);
}

// ============================================================
// SHOW COLOURFUL QUIZ RESULTS
// ============================================================

function showQuizResults(score) {
    const container = getElement("quiz");

    if (!container) {
        return;
    }

    const total = quizQuestions.length;

    const percentage = total
        ? Math.round((score / total) * 100)
        : 0;

    let resultIcon = "📚";
    let resultTitle = "Keep Practising!";
    let scoreClass = "score-low";

    if (percentage === 100) {
        resultIcon = "🏆";
        resultTitle = "Perfect Score!";
        scoreClass = "score-perfect";
    } else if (percentage >= 80) {
        resultIcon = "🎉";
        resultTitle = "Excellent Work!";
        scoreClass = "score-excellent";
    } else if (percentage >= 60) {
        resultIcon = "👏";
        resultTitle = "Good Job!";
        scoreClass = "score-good";
    } else if (percentage >= 40) {
        resultIcon = "💪";
        resultTitle = "Nice Try!";
        scoreClass = "score-average";
    }

    let html = `
        <div class="quiz-results">

            <div class="result-hero ${scoreClass}">
                <div class="result-icon">${resultIcon}</div>

                <div class="result-score ${percentage >= 60 ? "score-good" : "score-bad"}">
                    ${score}<span>/${total}</span>
                </div>

                <div class="result-percentage">
                    ${percentage}%
                </div>

                <h2>${resultTitle}</h2>

                <p>
                    You answered ${score} out of ${total} questions correctly.
                </p>

                <div class="result-score-track">
                    <div style="width:${percentage}%"></div>
                </div>

                <div class="result-message">
                    ${
                        percentage === 100
                            ? "🌟 Amazing! You answered every question correctly."
                            : percentage >= 80
                                ? "🎯 Great job! Review any mistakes to master the topic."
                                : percentage >= 60
                                    ? "👍 Good effort! A little more practice will help."
                                    : "📖 Keep learning! Review the correct answers below."
                    }
                </div>
            </div>

            <div class="results-title">
                📋 Answer Review
            </div>

            <p class="review-subtitle">
                Green means correct. Red means incorrect.
            </p>
    `;

    quizQuestions.forEach((question, index) => {
        const userAnswer = selectedAnswers[index];
        const correctAnswer = getCorrectAnswerIndex(question);

        const isCorrect = Number(userAnswer) === correctAnswer;

        const userAnswerText =
            userAnswer !== null &&
            question.options[userAnswer] !== undefined
                ? question.options[userAnswer]
                : "Not answered";

        const correctAnswerText =
            correctAnswer >= 0 &&
            question.options[correctAnswer] !== undefined
                ? question.options[correctAnswer]
                : "Correct answer unavailable";

        html += `
            <div class="result-question ${
                isCorrect ? "result-correct" : "result-wrong"
            }">

                <div class="result-question-header">
                    <div class="result-number">
                        ${isCorrect ? "✓" : "✕"}
                    </div>

                    <div class="result-question-title">
                        <span>QUESTION ${index + 1}</span>
                        <strong>
                            ${isCorrect ? "✓ Correct Answer" : "✕ Wrong Answer"}
                        </strong>
                    </div>

                    <span class="result-status-badge ${
                        isCorrect ? "badge-correct" : "badge-wrong"
                    }">
                        ${isCorrect ? "+1 POINT" : "0 POINTS"}
                    </span>
                </div>

                <h3>${escapeHTML(question.question)}</h3>

                <div class="answer-review">

                    <div class="your-answer ${
                        isCorrect ? "correct-answer-box" : "wrong-answer-text"
                    }">
                        <span>
                            ${isCorrect ? "🟢 Your Answer" : "🔴 Your Answer"}
                        </span>

                        <strong>${escapeHTML(userAnswerText)}</strong>
                    </div>

                    ${
                        !isCorrect
                            ? `
                                <div class="correct-answer-box">
                                    <span>✅ Correct Answer</span>
                                    <strong>${escapeHTML(correctAnswerText)}</strong>
                                </div>
                            `
                            : ""
                    }

                </div>

                <div class="explanation-box">
                    <span>💡 Explanation</span>
                    <p>
                        ${escapeHTML(
                            question.explanation ||
                            "Review this answer to reinforce your understanding."
                        )}
                    </p>
                </div>

            </div>
        `;
    });

    html += `
            <button
                type="button"
                class="try-again-button"
                onclick="restartQuiz()"
            >
                🔄 Try Quiz Again
            </button>

        </div>
    `;

    container.innerHTML = html;

    container.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

// ============================================================
// RESTART QUIZ
// ============================================================

function restartQuiz() {
    if (!quizQuestions.length) {
        return;
    }

    selectedAnswers = new Array(quizQuestions.length).fill(null);
    quizSubmitted = false;

    renderAllQuizQuestions();

    const container = getElement("quiz");

    if (container) {
        container.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }
}

// ============================================================
// MAKE FUNCTIONS AVAILABLE TO HTML
// ============================================================

window.askQuestion = askQuestion;
window.summarizeNotes = summarizeNotes;
window.generateQuiz = generateQuiz;
window.selectQuizAnswer = selectQuizAnswer;
window.submitQuiz = submitQuiz;
window.restartQuiz = restartQuiz;
window.downloadAnswer = downloadAnswer;