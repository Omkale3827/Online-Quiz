package com.omnix.model;

import java.time.LocalDateTime;
import java.util.List;

public class QuizAttempt {
    private String id;
    private String userId;
    private String userName;
    private String userEmail;
    private String categoryId;
    private String categoryName;
    private int attemptNumber; // 1 or 2 (maximum 2 enforced)
    private int score;
    private int totalQuestions;
    private int percentage;
    private boolean passed;
    private LocalDateTime timestamp;
    private List<AnswerRecord> answers;

    public QuizAttempt() {
        this.timestamp = LocalDateTime.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getUserName() { return userName; }
    public void setUserName(String userName) { this.userName = userName; }

    public String getUserEmail() { return userEmail; }
    public void setUserEmail(String userEmail) { this.userEmail = userEmail; }

    public String getCategoryId() { return categoryId; }
    public void setCategoryId(String categoryId) { this.categoryId = categoryId; }

    public String getCategoryName() { return categoryName; }
    public void setCategoryName(String categoryName) { this.categoryName = categoryName; }

    public int getAttemptNumber() { return attemptNumber; }
    public void setAttemptNumber(int attemptNumber) { this.attemptNumber = attemptNumber; }

    public int getScore() { return score; }
    public void setScore(int score) { this.score = score; }

    public int getTotalQuestions() { return totalQuestions; }
    public void setTotalQuestions(int totalQuestions) { this.totalQuestions = totalQuestions; }

    public int getPercentage() { return percentage; }
    public void setPercentage(int percentage) { this.percentage = percentage; }

    public boolean isPassed() { return passed; }
    public void setPassed(boolean passed) { this.passed = passed; }

    public LocalDateTime getTimestamp() { return timestamp; }
    public void setTimestamp(LocalDateTime timestamp) { this.timestamp = timestamp; }

    public List<AnswerRecord> getAnswers() { return answers; }
    public void setAnswers(List<AnswerRecord> answers) { this.answers = answers; }
}
