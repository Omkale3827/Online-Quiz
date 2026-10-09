package com.omnix.model;

import java.util.List;

public class Question {
    private String id;
    private String categoryId;
    private String questionText;
    private List<String> options;
    private int correctIndex; // 0, 1, 2, or 3
    private String explanation;

    public Question() {}

    public Question(String id, String categoryId, String questionText, List<String> options, int correctIndex, String explanation) {
        this.id = id;
        this.categoryId = categoryId;
        this.questionText = questionText;
        this.options = options;
        this.correctIndex = correctIndex;
        this.explanation = explanation;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getCategoryId() { return categoryId; }
    public void setCategoryId(String categoryId) { this.categoryId = categoryId; }

    public String getQuestionText() { return questionText; }
    public void setQuestionText(String questionText) { this.questionText = questionText; }

    public List<String> getOptions() { return options; }
    public void setOptions(List<String> options) { this.options = options; }

    public int getCorrectIndex() { return correctIndex; }
    public void setCorrectIndex(int correctIndex) { this.correctIndex = correctIndex; }

    public String getExplanation() { return explanation; }
    public void setExplanation(String explanation) { this.explanation = explanation; }
}
