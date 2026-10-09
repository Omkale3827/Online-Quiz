package com.omnix;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class OmnixApplication {
    public static void main(String[] args) {
        SpringApplication.run(OmnixApplication.class, args);
        System.out.println("🚀 OMNIX Spring Boot REST API is running on port 8080");
    }
}
