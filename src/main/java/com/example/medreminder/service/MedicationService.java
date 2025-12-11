package com.example.medreminder.service;

import com.example.medreminder.model.Medication;
import com.example.medreminder.repository.MedicationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class MedicationService {

    @Autowired
    private MedicationRepository repo;

    public Medication addMedication(Medication med) {
        return repo.save(med);
    }

    public List<Medication> getAllMedications() {
        return repo.findAll();
    }

    public Medication getMedicationById(Long id) {
        return repo.findById(id).orElse(null);
    }

    public void deleteMedication(Long id) {
        repo.deleteById(id);
    }

    public List<Medication> getMedicationsByUserId(Long userId) {
        return repo.findByUser_Id(userId);
    }

    // Record taken/missed
    public Medication recordTaken(Long medId, String dateTime, boolean taken) {
        Medication med = repo.findById(medId).orElse(null);
        if (med != null) {
            med.recordTaken(dateTime, taken);
            return repo.save(med);
        }
        return null;
    }

    // Weekly report
    public Map<String, Object> getWeeklyReport(Long userId) {
        List<Medication> meds = repo.findByUser_Id(userId);
        int total = 0, taken = 0;

        LocalDate today = LocalDate.now();

        for (Medication m : meds) {
            for (String time : m.getTimesList()) {
                for (int i = 0; i <= 7; i++) {
                    LocalDate day = today.minusDays(i);
                    if ((day.isEqual(m.getStartDate()) || day.isAfter(m.getStartDate())) &&
                        (day.isEqual(m.getEndDate())   || day.isBefore(m.getEndDate()))) {
                        total++;
                        Boolean t = m.isTaken(day + "T" + time);
                        if (t != null && t) taken++;
                    }
                }
            }
        }

        Map<String, Object> report = new HashMap<>();
        report.put("totalDoses", total);
        report.put("takenDoses", taken);
        report.put("missedDoses", total - taken);
        report.put("adherencePercent", total == 0 ? 0 : (taken * 100 / total));
        return report;
    }
}

