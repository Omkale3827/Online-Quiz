package com.omnix.controller;

import com.omnix.model.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/quizzes")
@CrossOrigin(origins = "*")
public class QuizController {

    // In-memory thread-safe stores for Spring Boot reference implementation
    private static final Map<String, Question> questionsStore = new ConcurrentHashMap<>();
    private static final List<QuizAttempt> attemptsStore = Collections.synchronizedList(new ArrayList<>());
    private static final int MAX_ATTEMPTS_ALLOWED = 2;

    /**
     * Check attempt eligibility for a user on a given quiz
     */
    @GetMapping("/{categoryId}/status")
    public ResponseEntity<?> getQuizStatus(@PathVariable String categoryId, @RequestParam(required = false) String userId) {
        long attemptCount = 0;
        if (userId != null && !userId.isBlank()) {
            attemptCount = attemptsStore.stream()
                .filter(a -> a.getUserId().equals(userId) && a.getCategoryId().equals(categoryId))
                .count();
        }

        Map<String, Object> response = new HashMap<>();
        response.put("categoryId", categoryId);
        response.put("attemptCount", attemptCount);
        response.put("maxAttempts", MAX_ATTEMPTS_ALLOWED);
        response.put("canAttempt", attemptCount < MAX_ATTEMPTS_ALLOWED);
        response.put("isMaxReached", attemptCount >= MAX_ATTEMPTS_ALLOWED);

        return ResponseEntity.ok(response);
    }

    /**
     * Submit Quiz - Strict 2-Attempt Validation Rule
     */
    @PostMapping("/{categoryId}/submit")
    public ResponseEntity<?> submitQuiz(
            @PathVariable String categoryId,
            @RequestBody Map<String, Object> submissionPayload,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId) {

        String userId = (String) submissionPayload.getOrDefault("userId", headerUserId);
        if (userId == null || userId.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "User authentication required"));
        }

        // 1. Strict 2-Attempt Restriction check
        List<QuizAttempt> userPriorAttempts = attemptsStore.stream()
                .filter(a -> a.getUserId().equals(userId) && a.getCategoryId().equals(categoryId))
                .collect(Collectors.toList());

        if (userPriorAttempts.size() >= MAX_ATTEMPTS_ALLOWED) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "error", "Maximum attempts reached (2/2). No further submissions allowed for this quiz.",
                    "isMaxReached", true,
                    "attemptsCount", userPriorAttempts.size()
            ));
        }

        // 2. Score Calculation and Review Generation
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> submittedAnswers = (List<Map<String, Object>>) submissionPayload.get("answers");
        List<Question> categoryQuestions = questionsStore.values().stream()
                .filter(q -> q.getCategoryId().equals(categoryId))
                .collect(Collectors.toList());

        int score = 0;
        List<AnswerRecord> evaluatedAnswers = new ArrayList<>();

        for (Question q : categoryQuestions) {
            Integer selectedOpt = null;
            if (submittedAnswers != null) {
                for (Map<String, Object> userAns : submittedAnswers) {
                    if (q.getId().equals(userAns.get("questionId"))) {
                        selectedOpt = (Integer) userAns.get("selectedOption");
                        break;
                    }
                }
            }

            boolean isCorrect = selectedOpt != null && selectedOpt == q.getCorrectIndex();
            if (isCorrect) score++;

            evaluatedAnswers.add(new AnswerRecord(
                    q.getId(),
                    q.getQuestionText(),
                    q.getOptions(),
                    selectedOpt,
                    q.getCorrectIndex(),
                    isCorrect,
                    q.getExplanation()
            ));
        }

        int totalQuestions = categoryQuestions.isEmpty() ? 1 : categoryQuestions.size();
        int percentage = Math.round(((float) score / totalQuestions) * 100);

        // 3. Create and Save QuizAttempt
        QuizAttempt attempt = new QuizAttempt();
        attempt.setId("att-" + System.currentTimeMillis());
        attempt.setUserId(userId);
        attempt.setCategoryId(categoryId);
        attempt.setAttemptNumber(userPriorAttempts.size() + 1);
        attempt.setScore(score);
        attempt.setTotalQuestions(totalQuestions);
        attempt.setPercentage(percentage);
        attempt.setPassed(percentage >= 60);
        attempt.setTimestamp(LocalDateTime.now());
        attempt.setAnswers(evaluatedAnswers);

        attemptsStore.add(attempt);

        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "message", "Quiz successfully submitted and evaluated",
                "attempt", attempt,
                "remainingAttempts", MAX_ATTEMPTS_ALLOWED - attempt.getAttemptNumber()
        ));
    }
}
