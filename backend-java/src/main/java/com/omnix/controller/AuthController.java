package com.omnix.controller;

import com.omnix.model.User;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    private static final Map<String, User> usersDb = new ConcurrentHashMap<>();

    static {
        // Seed default users
        usersDb.put("user@omnix.com", new User("user-1", "Demo Student", "user@omnix.com", "user123", "ROLE_USER"));
        usersDb.put("admin@omnix.com", new User("admin-1", "System Administrator", "admin@omnix.com", "admin123", "ROLE_ADMIN"));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> credentials) {
        String email = credentials.get("email");
        String password = credentials.get("password");
        String requestedRole = credentials.get("requestedRole");

        if (email == null || password == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email and password are required"));
        }

        User user = usersDb.get(email.toLowerCase());
        if (user == null || !user.getPassword().equals(password)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Invalid email or password"));
        }

        if ("ROLE_ADMIN".equals(requestedRole) && !"ROLE_ADMIN".equals(user.getRole())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Administrator privileges required"));
        }

        String token = Base64.getEncoder().encodeToString((user.getId() + ":" + user.getEmail() + ":" + user.getRole()).getBytes());

        return ResponseEntity.ok(Map.of(
            "message", "Login successful",
            "token", token,
            "user", user
        ));
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, String> payload) {
        String name = payload.get("name");
        String email = payload.get("email");
        String password = payload.get("password");

        if (name == null || email == null || password == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Name, email, and password required"));
        }

        if (usersDb.containsKey(email.toLowerCase())) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", "Account with this email already exists"));
        }

        User newUser = new User("user-" + System.currentTimeMillis(), name, email.toLowerCase(), password, "ROLE_USER");
        usersDb.put(email.toLowerCase(), newUser);

        String token = Base64.getEncoder().encodeToString((newUser.getId() + ":" + newUser.getEmail() + ":ROLE_USER").getBytes());

        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
            "message", "Registration successful",
            "token", token,
            "user", newUser
        ));
    }
}
