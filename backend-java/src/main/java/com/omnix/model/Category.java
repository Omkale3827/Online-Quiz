package com.omnix.model;

import java.util.List;

public class Category {
    private String id;
    private String name;
    private String icon;
    private String difficulty; // Easy, Medium, Hard
    private String description;
    private int totalTimeMinutes;

    public Category() {}

    public Category(String id, String name, String icon, String difficulty, String description, int totalTimeMinutes) {
        this.id = id;
        this.name = name;
        this.icon = icon;
        this.difficulty = difficulty;
        this.description = description;
        this.totalTimeMinutes = totalTimeMinutes;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getIcon() { return icon; }
    public void setIcon(String icon) { this.icon = icon; }

    public String getDifficulty() { return difficulty; }
    public void setDifficulty(String difficulty) { this.difficulty = difficulty; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public int getTotalTimeMinutes() { return totalTimeMinutes; }
    public void setTotalTimeMinutes(int totalTimeMinutes) { this.totalTimeMinutes = totalTimeMinutes; }
}
