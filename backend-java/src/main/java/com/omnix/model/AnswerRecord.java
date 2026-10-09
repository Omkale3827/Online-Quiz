package com.omnix.model;

import java.util.List;

public class AnswerRecord {
    private String questionId;
    private String questionText;
    private List<String> options;
    private Integer selectedOption; // 0, 1, 2, 3 or null
    private int correctOption;
    private boolean isCorrect;
    private String explanation;

    public AnswerRecord() {}

    public AnswerRecord(String questionId, String questionText, List<String> options, Integer selectedOption, int correctOption, boolean isCorrect, String explanation) {
        this.questionId = questionId;
        this.questionText = questionText;
        this.options = options;
        this.selectedOption = selectedOption;
        this.correctOption = correctOption;
        this.isCorrect = isCorrect;
        this.explanation = explanation;
    }

    public String getQuestionId() { return questionId; }
    public void setQuestionId(String questionId) { this.questionId = questionId; }

    public String getQuestionText() { return questionText; }
    public void setQuestionText(String questionText) { this.questionText = questionText; }

    public List<String> getOptions() { return options; }
    public void setOptions(List<String> options) { this.options = options; }

    public Integer getSelectedOption() { return selectedOption; }
    public void setSelectedOption(Integer selectedOption) { this.selectedOption = selectedOption; }

    public int getCorrectOption() { return correctOption; }
    public void setCorrectOption(int correctOption) { this.correctOption = correctOption; }

    public boolean isCorrect() { return isCorrect; }
    public void setCorrect(boolean correct) { isCorrect = correct; }

    public String getExplanation() { return explanation; }
    public void setExplanation(String explanation) { this.explanation = explanation; }
}
