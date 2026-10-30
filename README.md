# QuizCraft — Interactive Online Quiz Platform

> **Master Every Domain.** A responsive full-stack online quiz and skill-assessment platform with dedicated User and Admin ecosystems, strict 2-attempt validation, instant scoring analytics, and comprehensive answer rationales.

---

## 🌟 Key Architecture & Highlights

1. **Dual Ecosystem Architecture**:
   - **Candidate / Student Portal (`ROLE_USER`)**: Category dashboard, live attempt quota badges (`0/2`, `1/2`, `2/2`), distraction-free quiz room with countdown timer, keyboard shortcuts (1-4, A-D), and post-quiz review scorecard.
   - **Administrator Intelligence Console (`ROLE_ADMIN`)**: Platform overview metrics, registered users directory, question bank CRUD, and the **Candidate Submission Tracker** (comparing **Latest Attempt** vs **Previous Attempt** timestamps, scores, and performance deltas).
2. **Attempt Restriction Engine**:
   - Hard constraint: Candidates are strictly restricted to a **maximum of 2 attempts** per quiz.
   - Evaluated both client-side and server-side (HTTP 403 Forbidden on excess attempts).
   - Once `attempts >= 2`, the "Start Quiz" button is locked and displays `Maximum Attempts Reached (2/2)` alongside a `View Last Result` review shortcut.
3. **Comprehensive Post-Quiz Review Screen**:
   - Total score, percentage, pass/fail status, and attempt counter (`Attempt #1 of 2` vs `Attempt #2 of 2`).
   - Detailed question-by-question breakdown:
     - User's selected answer choice.
     - Correct answer highlighted in soft green (`#D1FAE5`, border `#10B981`).
     - Wrong answers highlighted in soft red (`#FEE2E2`, border `#EF4444`).
     - Clear conceptual explanation and rationale for every question.
4. **Dual Backend Implementations**:
   - **Live Node.js / Express Server**: Ready and running out-of-the-box with persistent JSON storage.
   - **Java Spring Boot Reference**: Complete Maven architecture in `backend-java/` featuring models, controllers, and services implementing the 2-attempt validation engine.

---

## 🎨 Theme & Visual Palette

- **Base Colors**: Pure White (`#FFFFFF`), Light Cool Gray (`#F8FAFC`, `#F1F5F9`), Slate Borders (`#E2E8F0`).
- **Typography**: Deep Charcoal / Navy (`#0F172A`, `#334155`) with font family **Plus Jakarta Sans** & **Inter**.
- **Accents**: Vibrant Modern Indigo & Azure (`#4F46E5`, `#4338CA`, `#0EA5E9`).
- **Semantic Badges**: Soft Emerald Success (`#10B981`), Soft Rose Danger (`#EF4444`), Soft Amber Warning (`#F59E0B`).

---

## 🚀 Quick Start Guide

### 1. Running the Live Node.js / Express Backend & Frontend

The application is powered by an Express server that serves both the REST API and the frontend pages.

```bash
# Start the server (runs on port 3000)
npm start
# or: node server.js
```

Once started, open your browser to:
- **Landing Page**: [http://localhost:3000](http://localhost:3000)
- **Candidate Dashboard**: [http://localhost:3000/user-dashboard.html](http://localhost:3000/user-dashboard.html)
- **Admin Console**: [http://localhost:3000/admin-dashboard.html](http://localhost:3000/admin-dashboard.html)
- **Question Manager**: [http://localhost:3000/question-manager.html](http://localhost:3000/question-manager.html)

### 2. Default Demo Credentials

| Role | Email | Password | Pre-configured Data |
|---|---|---|---|
| **Student / Candidate** | `user@omnix.com` | `user123` | Has 1 attempt on General Knowledge |
| **Administrator** | `admin@omnix.com` | `admin123` | Full access to question CRUD and analytics |
| **Sample Candidate 2** | `alex@example.com` | `user123` | Has reached 2/2 max attempts on Java |
| **Sample Candidate 3** | `priya@example.com` | `user123` | Has 1 perfect score attempt on Web Dev |

*(Click "Fill Demo Student" or "Fill Demo Admin" on the login modal to auto-populate credentials instantly!)*

---

## 📁 Directory Structure

```text
antigravity-java/
├── server.js                        # Main Express backend & static web server
├── package.json                     # Node project configuration
├── data/
│   ├── db.js                        # JSON database persistence helper
│   ├── db.json                      # Live persisted database state
│   └── seedData.js                  # Initial seed categories, questions, users & logs
├── routes/
│   ├── authRoutes.js                # Auth & RBAC endpoints (/api/auth)
│   ├── categoryRoutes.js            # Category CRUD endpoints (/api/categories)
│   ├── questionRoutes.js            # Question CRUD endpoints (/api/questions)
│   ├── quizRoutes.js                # Quiz workflow & 2-attempt validation engine (/api/quizzes)
│   └── adminRoutes.js               # Admin analytics & submission comparison (/api/admin)
├── public/
│   ├── index.html                   # Landing page with hero & dual-entry auth gateway
│   ├── user-dashboard.html          # Candidate category grid with attempt counters
│   ├── quiz-room.html               # Distraction-free quiz room & answer review screen
│   ├── admin-dashboard.html         # Admin analytics & candidate submission comparison tracker
│   ├── question-manager.html        # Question Bank & category authoring CRUD interface
│   ├── css/
│   │   └── style.css                # Custom theme design system & animations
│   └── js/
│       ├── api.js                   # Central API client & toast notifications
│       ├── auth.js                  # RBAC route guards & session storage
│       ├── dashboard.js             # User category grid & attempt status logic
│       ├── quiz.js                  # Quiz execution, timer, submit confirmation & reviews
│       ├── admin.js                 # Admin dashboard analytics & submission comparison
│       └── questions.js             # Admin question CRUD and modal forms
└── backend-java/                    # Complete Java Spring Boot reference backend
    ├── pom.xml                      # Maven dependencies (Spring Web, Validation)
    └── src/main/
        ├── resources/
        │   └── application.properties
        └── java/com/omnix/
            ├── OmnixApplication.java
            ├── model/
            │   ├── User.java
            │   ├── Category.java
            │   ├── Question.java
            │   ├── AnswerRecord.java
            │   └── QuizAttempt.java
            └── controller/
                ├── AuthController.java
                ├── QuestionAdminController.java
                └── QuizController.java # Java implementation of 2-attempt validation engine
```

---

## 📡 REST API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Authenticate user or admin with credentials |
| `POST` | `/api/auth/register` | Register new candidate account |
| `GET` | `/api/auth/me` | Fetch active user profile from token |
| `GET` | `/api/categories` | Retrieve all quiz domains with active question counts |
| `POST` | `/api/categories` | Admin: Create new quiz category domain |
| `DELETE` | `/api/categories/:id` | Admin: Delete category and its questions |
| `GET` | `/api/quizzes/:categoryId/status` | Get attempt count, max limit, and eligibility for user |
| `GET` | `/api/quizzes/:categoryId/questions` | Fetch questions without leaking answers (sanitized) |
| `POST` | `/api/quizzes/:categoryId/submit` | **Enforces strict 2-attempt rule**, calculates score, returns review |
| `GET` | `/api/quizzes/attempt/:attemptId` | Retrieve full attempt record with questions and explanations |
| `GET` | `/api/questions` | Admin: Retrieve questions with answers & explanations |
| `POST` | `/api/questions` | Admin: Create new 4-option question |
| `PUT` | `/api/questions/:id` | Admin: Update existing question |
| `DELETE` | `/api/questions/:id` | Admin: Delete question |
| `GET` | `/api/admin/analytics` | Admin: Platform overview metrics & category stats |
| `GET` | `/api/admin/users` | Admin: Candidate directory with quiz attempt frequency |
| `GET` | `/api/admin/attempts` | Admin: Candidate logs with **Latest vs Previous Attempt** tracking |
| `POST` | `/api/admin/reset` | Admin: Reset database to default clean seed data |
