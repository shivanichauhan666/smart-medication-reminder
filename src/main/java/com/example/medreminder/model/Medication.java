package com.example.medreminder.model;
import com.fasterxml.jackson.annotation.JsonBackReference;
import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Entity
public class Medication {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private String dosage;

    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate startDate;

    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate endDate;

    private String times; // "08:00,20:00"

    @ManyToOne
    @JoinColumn(name = "user_id")
    @JsonBackReference
    private User user;

    @ElementCollection
    @CollectionTable(name = "med_taken_records", joinColumns = @JoinColumn(name = "med_id"))
    @MapKeyColumn(name = "date_time")
    @Column(name = "taken")
    private Map<String, Boolean> takenRecords = new HashMap<>();

    // =======================
    // Constructors
    // =======================
    public Medication() {
        // Default constructor
    }

    // Convenience constructor for sample data
    public Medication(String name, String dosage, String times, LocalDate startDate, LocalDate endDate, User user) {
        this.name = name;
        this.dosage = dosage;
        setTimes(times); // ensures trimmed
        this.startDate = startDate;
        this.endDate = endDate;
        this.user = user;
    }

    // =======================
    // Getters & Setters
    // =======================
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDosage() { return dosage; }
    public void setDosage(String dosage) { this.dosage = dosage; }

    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }

    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }

    public String getTimes() { return times; }

    // Ensures times are stored without extra spaces
    public void setTimes(String times) {
        if (times != null) {
            this.times = String.join(",", times.replaceAll("\\s+", "").split(","));
        } else {
            this.times = null;
        }
    }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public Map<String, Boolean> getTakenRecords() { return takenRecords; }
    public void setTakenRecords(Map<String, Boolean> takenRecords) { this.takenRecords = takenRecords; }

    // =======================
    // Helper Methods
    // =======================

    // Returns times as list
    public List<String> getTimesList() {
        List<String> list = new ArrayList<>();
        if (times != null && !times.isEmpty()) {
            for (String t : times.split(",")) list.add(t.trim());
        }
        return list;
    }

    // Record medicine taken/missed
    public void recordTaken(String dateTime, boolean taken) {
        takenRecords.put(dateTime, taken);
    }

    // Check if medicine was taken at a specific datetime
    public Boolean isTaken(String dateTime) {
        return takenRecords.get(dateTime);
    }
}
