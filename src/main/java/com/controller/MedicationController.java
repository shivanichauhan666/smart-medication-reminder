package com.example.medreminder.controller;

import com.example.medreminder.model.Medication;
import com.example.medreminder.model.User;
import com.example.medreminder.repository.MedicationRepository;
import com.example.medreminder.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/medications")
@CrossOrigin(origins = "*") // allow your frontend origin
public class MedicationController {

    @Autowired
    private MedicationRepository medRepo;

    @Autowired
    private UserRepository userRepo;

    // ==========================
    // Get medications for a user
    // ==========================
    @GetMapping("/user/{userId}")
    public List<Medication> getMedsByUser(@PathVariable Long userId){
        return medRepo.findByUser_Id(userId);
    }

    // ==========================
    // Add a medication
    // ==========================
    @PostMapping
    public Medication addMedication(@RequestBody Medication med){
        // Ensure user exists
        Long userId = med.getUser().getId();
        User user = userRepo.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        med.setUser(user);
        return medRepo.save(med);
    }

    // ==========================
    // Delete a medication
    // ==========================
    @DeleteMapping("/{id}")
    public void deleteMedication(@PathVariable Long id){
        medRepo.deleteById(id);
    }

    // ==========================
    // Get medication by id
    // ==========================
    @GetMapping("/{id}")
    public Medication getMedicationById(@PathVariable Long id){
        return medRepo.findById(id).orElse(null);
    }

    // ==========================
    // Record medicine taken/missed
    // ==========================
@PostMapping("/record/{medId}")
public Medication recordTaken(@PathVariable Long medId, @RequestBody Map<String, Object> payload) {

    boolean taken = Boolean.parseBoolean(payload.get("taken").toString());

    Medication med = medRepo.findById(medId)
            .orElseThrow(() -> new RuntimeException("Medication not found"));

    // Today's date
    LocalDate today = LocalDate.now();

    // For every scheduled time, create the correct datetime key
    for (String time : med.getTimesList()) {
        String dateTimeKey = today + "T" + time;   // Example: 2025-12-09T14:00
        med.recordTaken(dateTimeKey, taken);
    }

    return medRepo.save(med);
}



    // ==========================
    // Weekly adherence report
    // ==========================
  @GetMapping("/weekly/{userId}")
public Map<String, Object> getWeeklyReport(@PathVariable Long userId){
    List<Medication> meds = medRepo.findByUser_Id(userId);

    int total = 0, taken = 0;
    LocalDate today = LocalDate.now();

    // Last 7 days including today
    for(int i = 0; i < 7; i++){
        LocalDate day = today.minusDays(i);

        for(Medication med : meds){
            // Check if medication is active on this day
            if(day.isBefore(med.getStartDate()) || day.isAfter(med.getEndDate())) continue;

            for(String time : med.getTimesList()){
                total++;

                // Match the taken record key
                String key = day + "T" + time;
                Boolean t = med.getTakenRecords().get(key);
                if(t != null && t) taken++;
            }
        }
    }

    int missed = total - taken;
    int adherencePercent = total == 0 ? 0 : (taken * 100 / total);

    return Map.of(
            "totalDoses", total,
            "takenDoses", taken,
            "missedDoses", missed,
            "adherencePercent", adherencePercent
    );
}
}


