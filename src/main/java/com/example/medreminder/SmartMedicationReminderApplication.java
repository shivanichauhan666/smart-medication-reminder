package com.example.medreminder;

import com.example.medreminder.model.User;
import com.example.medreminder.model.Medication;
import com.example.medreminder.repository.UserRepository;
import com.example.medreminder.repository.MedicationRepository;

import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

import java.time.LocalDate;

@SpringBootApplication
public class SmartMedicationReminderApplication {

    public static void main(String[] args) {
        SpringApplication.run(SmartMedicationReminderApplication.class, args);
    }

    // ========================
    // Load sample data at startup
    // ========================
    @Bean
    public CommandLineRunner loadData(UserRepository userRepo, MedicationRepository medRepo) {
        return args -> {
            // Sample user
            User user = new User();
            user.setUsername("Shivani");
            userRepo.save(user);

            // Sample medications
            Medication med1 = new Medication("Dolo 650", "1 tablet", "08:00,20:00",
                    LocalDate.now(), LocalDate.now().plusDays(5), user);
            Medication med2 = new Medication("Vitamin C", "1 tablet", "09:00",
                    LocalDate.now(), LocalDate.now().plusDays(7), user);

            medRepo.save(med1);
            medRepo.save(med2);
        };
    }
}


