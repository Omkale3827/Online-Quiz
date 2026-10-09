package com.omnix.controller;

import com.omnix.model.Question;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/questions")
@CrossOrigin(origins = "*")
public class QuestionAdminController {

    private static final Map<String, Question> questionsStore = new ConcurrentHashMap<>();

    @GetMapping
    public ResponseEntity<List<Question>> getAllQuestions(@RequestParam(required = false) String categoryId) {
        if (categoryId != null && !categoryId.isBlank()) {
            return ResponseEntity.ok(questionsStore.values().stream()
                    .filter(q -> q.getCategoryId().equals(categoryId))
                    .collect(Collectors.toList()));
        }
        return ResponseEntity.ok(new ArrayList<>(questionsStore.values()));
    }

    @PostMapping
    public ResponseEntity<?> createQuestion(@RequestBody Question question) {
        if (question.getQuestionText() == null || question.getOptions() == null || question.getOptions().size() != 4) {
            return ResponseEntity.badRequest().body(Map.of("error", "Question text and exactly 4 options are required"));
        }

        question.setId("q-" + System.currentTimeMillis());
        questionsStore.put(question.getId(), question);
        return ResponseEntity.status(HttpStatus.CREATED).body(question);
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateQuestion(@PathVariable String id, @RequestBody Question question) {
        if (!questionsStore.containsKey(id)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Question not found"));
        }
        question.setId(id);
        questionsStore.put(id, question);
        return ResponseEntity.ok(question);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteQuestion(@PathVariable String id) {
        if (questionsStore.remove(id) == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Question not found"));
        }
        return ResponseEntity.ok(Map.of("message", "Question deleted successfully"));
    }
}
